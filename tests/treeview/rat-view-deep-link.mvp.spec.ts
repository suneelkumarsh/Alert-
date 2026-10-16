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

import { test, expect } from '../../fixtures';
import {
  deepLinkUrl,
  expectNoRequests,
  toggleButton,
  treeRow,
} from './rat-view.helpers';

// TNAP-30342 AC1 / AC1.1: a cell deep link must open the tree on that cell, expand the path down
// to it and show its detail pane with no interaction. This is the exact journey the Slice List
// "Open Cell … in Treeview" button creates (cell-table.component.ts emits aaiType: 'cell'), and it
// is a different reveal type from the PNF case covered in rat-view.mvp.spec.ts - `cell` is a
// leaf, so it is the one RevealNodeType that can never be a /children parentType.
//
// Runs under local-mvp only (see rat-view.mvp.spec.ts for why).

// No `path` field on purpose: this is a pre-path bookmark, so this file doubles as the RAT view's
// legacy-URL coverage (the reveal chain plus upgradeLegacySelection). Adding a path here would
// leave that untested - the node-view equivalent is node-view-legacy-deep-link.spec.ts.
const CELL = {
  id: '445611193271828482',
  name: '84000009',
  serviceType: 'cell',
  aaiType: 'cell',
};

test.describe(
  'Tree View - RAT view cell deep link',
  { tag: '@mvpOperator' },
  () => {
    test('opens the path down to a deep-linked cell and shows its details', async ({
      page,
    }) => {
      const treeRequests: string[] = [];

      page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/ran-treeview?')) {
          treeRequests.push(url);
        }
      });
      await page.goto(deepLinkUrl([CELL]));
      await expect(page.locator('app-rat-view')).toBeVisible();

      // Every level of the revealed path renders, and the cell itself is the leaf.
      const NMS1 = 'network-management-system:nms-e2e-01';
      const SI1 = 'service-instance:si-e2e-01';
      const PNF1 = 'pnf:pnf-e2e-01';
      const CELL_SEG = 'cell:445611193271828482';
      // The whole revealed path arrives in one paint, so only the first row waits for the
      // tree to load; the rest use the default timeout.
      await expect(treeRow(page, NMS1)).toBeVisible({ timeout: 30000 });
      await expect(treeRow(page, NMS1, SI1)).toBeVisible();
      await expect(treeRow(page, NMS1, SI1, PNF1)).toBeVisible();
      await expect(treeRow(page, NMS1, SI1, PNF1, CELL_SEG)).toBeVisible();

      // Ancestors are pre-opened; the cell has no chevron because a cell has no children.
      await expect(toggleButton(page, NMS1)).toHaveAttribute(
        'aria-label',
        'Collapse'
      );
      await expect(toggleButton(page, NMS1, SI1)).toHaveAttribute(
        'aria-label',
        'Collapse'
      );
      await expect(toggleButton(page, NMS1, SI1, PNF1)).toHaveAttribute(
        'aria-label',
        'Collapse'
      );
      await expect(toggleButton(page, NMS1, SI1, PNF1, CELL_SEG)).toHaveCount(
        0
      );

      // Sibling branches stay shut - a reveal opens one path, not the whole tree.
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-02')
      ).toBeVisible();
      await expect(
        treeRow(page, NMS1, 'service-instance:si-e2e-02')
      ).toHaveCount(0);

      // AC1.1: the detail pane is populated without a click, from /api/nodes/cells/<id> - not from
      // the tree payload, which carries no cell attributes at all. frequencyBand only exists in the
      // detail response, so rendering it proves the cell branch of getInstancePropertiesById ran.
      await expect(
        page.getByRole('heading', { level: 2, name: '84000009' })
      ).toBeVisible();
      await expect(
        page.locator('app-treeview-detail').getByText('n78', { exact: true })
      ).toBeVisible();

      // A cell reveal must send the type: without it the backend probes types in a fixed order and
      // an id shared with another type resolves to the wrong node.
      await expect.poll(() => treeRequests.length).toBeGreaterThan(0);
      expect(treeRequests.at(-1)).toContain('revealNodeId=445611193271828482');
      expect(treeRequests.at(-1)).toContain('revealNodeType=cell');
    });

    test('marks the deep-linked cell as the selected row', async ({ page }) => {
      await page.goto(deepLinkUrl([CELL]));
      await expect(page.locator('app-rat-view')).toBeVisible();

      const cellRow = treeRow(
        page,
        'network-management-system:nms-e2e-01',
        'service-instance:si-e2e-01',
        'pnf:pnf-e2e-01',
        'cell:445611193271828482'
      );
      await expect(cellRow).toBeVisible({ timeout: 30000 });

      // D-3: aria-selected is rendered on every row, so the *value* is what carries the meaning -
      // a `toHaveAttribute('aria-selected')` presence check would pass on an unselected row too.
      await expect(cellRow).toHaveAttribute('aria-selected', 'true');
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-01')
      ).toHaveAttribute('aria-selected', 'false');

      // Exactly one row is selected: the ancestors were opened, not activated. This is the assertion
      // that would catch a reveal implemented by selecting the whole path.
      await expect(
        page.locator('[role="treeitem"][aria-selected="true"]')
      ).toHaveCount(1);
    });

    test('does not offer a children request for a cell', async ({ page }) => {
      const childRequests: string[] = [];

      page.on('request', request => {
        if (request.url().includes('/api/ran-treeview/children')) {
          childRequests.push(request.url());
        }
      });
      await page.goto(deepLinkUrl([CELL]));
      await expect(page.locator('app-rat-view')).toBeVisible();

      const cell = treeRow(
        page,
        'network-management-system:nms-e2e-01',
        'service-instance:si-e2e-01',
        'pnf:pnf-e2e-01',
        'cell:445611193271828482'
      );
      await expect(cell).toBeVisible({ timeout: 30000 });

      // `cell` is not an accepted parentType, so a chevron on it would produce a guaranteed 400.
      // The revealed branch arrives materialised, so no /children call is needed for it either.
      await expect(
        toggleButton(
          page,
          'network-management-system:nms-e2e-01',
          'service-instance:si-e2e-01',
          'pnf:pnf-e2e-01',
          'cell:445611193271828482'
        )
      ).toHaveCount(0);
      await expectNoRequests(page, childRequests);
    });
  }
);
