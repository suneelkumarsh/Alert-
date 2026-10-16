/*
 * Copyright (c) 2026. Deutsche Telekom AG
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from '@playwright/test';
import { test } from '../../fixtures';
import { treeRow, toggleButton } from './rat-view.helpers';

// Wieslaw's bug: in a RAN tree a cell legitimately appears under BOTH its PNF (BBU) and that
// PNF's generic-VNF (gNodeB). Before path-scoped keys the library gave every occurrence the same
// id, so selection and scrolling resolved to whichever row appeared first in the flat list — the
// BBU row always won, even when the user clicked the gNodeB row.
//
// This file is the end-to-end proof that the fix holds, and the mutation check in Step 4 of the
// task brief is the evidence that the spec can actually fail.
//
// Runs under the local-mvp project only: `[pathScopedKeys]="true"` and `[twinOfSelectedLabel]`
// are set only on `<app-rat-view>`'s `<ng-treeview>`, and the rat view requires mvp_operator.

// Tree loaded via page.route() — not from WireMock — so this spec does not touch the shared
// WireMock state and existing tests are unaffected.  The cell id "cell-twin-01" is the same
// under both parents; that is the point.
const TWIN_TREE_ROOT = {
  id: 'nms-twin-01',
  name: 'mae-twin',
  type: 'network-management-system',
  serviceType: 'network-management-system',
  childCount: 1,
};

const TWIN_SI = {
  id: 'si-twin-01',
  name: 'gnb-twin-99',
  type: 'service-instance',
  serviceType: 'RAN Node',
  childCount: 2,
};

const BBU = {
  id: 'pnf-bbu-twin',
  name: 'bbu-twin',
  type: 'pnf',
  serviceType: 'pnf',
  childCount: 1,
};

const GNB = {
  id: 'gvnf-gnb-twin',
  name: 'gnb-twin',
  type: 'generic-vnf',
  serviceType: 'gNodeB',
  childCount: 1,
};

const CELL = {
  id: 'cell-twin-01',
  name: 'Cell Twin A',
  type: 'cell',
  serviceType: 'cell',
};

// Composed path keys for the two cell occurrences. These are the values the library writes into
// [id="treeitem-<key>"] and into aria-activedescendant.
const NMS = `network-management-system:${TWIN_TREE_ROOT.id}`;
const SI = `service-instance:${TWIN_SI.id}`;
const BBU_SEG = `pnf:${BBU.id}`;
const GNB_SEG = `generic-vnf:${GNB.id}`;
const CELL_SEG = `cell:${CELL.id}`;

test.describe(
  'Treeview twin occurrence selection',
  { tag: '@mvpOperator' },
  () => {
    test.beforeEach(async ({ page }) => {
      // Intercept every RAN-treeview request and serve the twin fixture instead of WireMock, so
      // this spec does not depend on shared stubs and does not alter them.
      await page.route('**/api/ran-treeview**', async route => {
        const url = route.request().url();
        const childrenPath = '/api/ran-treeview/children';

        if (url.includes(childrenPath)) {
          const params = new URL(url).searchParams;
          const parentId = params.get('parentId');
          const parentType = params.get('parentType');

          if (
            parentId === TWIN_TREE_ROOT.id &&
            parentType === 'network-management-system'
          ) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ items: [TWIN_SI] }),
            });
          } else if (
            parentId === TWIN_SI.id &&
            parentType === 'service-instance'
          ) {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ items: [BBU, GNB] }),
            });
          } else if (parentId === BBU.id && parentType === 'pnf') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ items: [CELL] }),
            });
          } else if (parentId === GNB.id && parentType === 'generic-vnf') {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ items: [CELL] }),
            });
          } else {
            await route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify({ items: [] }),
            });
          }
        } else {
          // Root request (depth=1 or reveal): return just the single NMS root.
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              items: [TWIN_TREE_ROOT],
              totalCount: 1,
              revealedPath: [],
            }),
          });
        }
      });

      // Return an empty stub for node-detail requests so the HttpError interceptor
      // does not fire an alert that obscures the tree state assertions.
      await page.route('**/api/nodes/**', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: '{}',
        })
      );

      await page.goto('/treeview');
      await expect(page.locator('app-rat-view')).toBeVisible();
      await expect(treeRow(page, NMS)).toBeVisible();

      // Expand NMS → SI → BBU and gNodeB, then BBU → cell and gNodeB → cell
      await toggleButton(page, NMS).click();
      await expect(treeRow(page, NMS, SI)).toBeVisible();

      await toggleButton(page, NMS, SI).click();
      await expect(treeRow(page, NMS, SI, BBU_SEG)).toBeVisible();
      await expect(treeRow(page, NMS, SI, GNB_SEG)).toBeVisible();

      await toggleButton(page, NMS, SI, BBU_SEG).click();
      await expect(treeRow(page, NMS, SI, BBU_SEG, CELL_SEG)).toBeVisible();

      await toggleButton(page, NMS, SI, GNB_SEG).click();
      await expect(treeRow(page, NMS, SI, GNB_SEG, CELL_SEG)).toBeVisible();

      // Verify that path-scoped keys are in effect: with pathScopedKeys=false both cells would
      // have the same id treeitem-cell:cell-twin-01. The two distinct path-based locators must
      // each find exactly ONE element (not zero and not two).
      await expect(treeRow(page, NMS, SI, BBU_SEG, CELL_SEG)).toHaveCount(1);
      await expect(treeRow(page, NMS, SI, GNB_SEG, CELL_SEG)).toHaveCount(1);
    });

    test('selects only the gNodeB occurrence when it is clicked', async ({
      page,
    }) => {
      const cellUnderGnb = treeRow(page, NMS, SI, GNB_SEG, CELL_SEG);
      const cellUnderBbu = treeRow(page, NMS, SI, BBU_SEG, CELL_SEG);

      await cellUnderGnb.click();

      // The clicked row is selected; the other occurrence is not.
      await expect(cellUnderGnb).toHaveAttribute('aria-selected', 'true');
      await expect(cellUnderBbu).toHaveAttribute('aria-selected', 'false');

      // The CSS class matches the aria attribute.
      // Match standalone `selected` (not part of `twin-of-selected`): require that
      // `selected` is either at the start/end of the string or surrounded by spaces.
      const standaloneSelected = /(?:^|\s)selected(?:\s|$)/;
      await expect(cellUnderGnb).toHaveClass(standaloneSelected);
      await expect(cellUnderBbu).not.toHaveClass(standaloneSelected);

      // 9e: exactly one row is selected across the whole tree.
      await expect(
        page.locator('[role="treeitem"][aria-selected="true"]')
      ).toHaveCount(1);
    });

    test('marks the non-selected occurrence as twin-of-selected', async ({
      page,
    }) => {
      const cellUnderGnb = treeRow(page, NMS, SI, GNB_SEG, CELL_SEG);
      const cellUnderBbu = treeRow(page, NMS, SI, BBU_SEG, CELL_SEG);

      await cellUnderGnb.click();

      // The BBU copy is not selected but carries the twin marker so the user can tell it is
      // the same entity without relying on colour alone (WCAG 2.2 SC 1.4.1).
      await expect(cellUnderBbu).toHaveClass(/twin-of-selected/);
      await expect(cellUnderGnb).not.toHaveClass(/twin-of-selected/);
    });

    test('announces the twin hint in the BBU cell row accessible name', async ({
      page,
    }) => {
      // 9g: [twinOfSelectedLabel] is bound on <ng-treeview>; the library appends it to the row's
      // aria-label. This e2e is the only coverage for that binding, because neither tree-mode
      // unit test renders the library with its ng-template (rat-view uses template:'', node-view
      // has pre-existing NG0302 debt).
      const cellUnderGnb = treeRow(page, NMS, SI, GNB_SEG, CELL_SEG);
      const cellUnderBbu = treeRow(page, NMS, SI, BBU_SEG, CELL_SEG);

      await cellUnderGnb.click();

      // The twin row's label is "${node.label}, ${twinOfSelectedLabel}" per the library contract.
      // English translation key treeview.twinOfSelected. The wording names the *other* row as the
      // selected one on purpose - this label decorates the row that is not selected.
      await expect(cellUnderBbu).toHaveAttribute(
        'aria-label',
        `${CELL.name}, Same object as the selected row, shown elsewhere in the tree`
      );

      // The selected row itself is NOT decorated with the twin hint.
      await expect(cellUnderGnb).toHaveAttribute('aria-label', CELL.name);
    });

    test('selecting the BBU occurrence moves the selection there', async ({
      page,
    }) => {
      const cellUnderGnb = treeRow(page, NMS, SI, GNB_SEG, CELL_SEG);
      const cellUnderBbu = treeRow(page, NMS, SI, BBU_SEG, CELL_SEG);

      // First select gNodeB, then switch to BBU.
      await cellUnderGnb.click();
      await expect(cellUnderGnb).toHaveAttribute('aria-selected', 'true');

      await cellUnderBbu.click();

      await expect(cellUnderBbu).toHaveAttribute('aria-selected', 'true');
      await expect(cellUnderGnb).toHaveAttribute('aria-selected', 'false');

      // After the switch the gNodeB row becomes the twin.
      await expect(cellUnderGnb).toHaveClass(/twin-of-selected/);
      await expect(cellUnderBbu).not.toHaveClass(/twin-of-selected/);

      await expect(
        page.locator('[role="treeitem"][aria-selected="true"]')
      ).toHaveCount(1);
    });
  }
);
