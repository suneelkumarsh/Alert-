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
  searchTree,
  toggleButton,
  treeRow,
} from './rat-view.helpers';

// TNAP-30772 AC1 / AC3: the RAT tree must render NMS, RAN Node, eNodeB, gNodeB, BTS, PNF and Cell
// as visually distinct, labelled node types.
//
// The discriminator is `serviceType`, NOT `type`/`aaiType`: RATVIEW_ICON's conditions compare
// `metadata.type`, which mapToFinalData fills from `serviceType.toUpperCase()`. The three
// generic-vnf rows below therefore share one aaiType and still have to render three different
// icons - which is exactly the mapping a type-based implementation would get wrong.
//
// Runs under local-mvp only (see rat-view.mvp.spec.ts for why).

const ICON_BASE = '/assets/images/icons/treeview';

test.describe(
  'Tree View - RAT view node types',
  { tag: '@mvpOperator' },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/treeview');
      await expect(page.locator('app-rat-view')).toBeVisible();
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-01')
      ).toBeVisible();
    });

    test('renders a distinct icon per RAN node type', async ({ page }) => {
      // One search brings all three generic-vnf flavours plus their NMS and RAN Node ancestors into
      // the tree at once, so a single pruned response covers five of the seven types.
      await searchTree(page, 'vnf-e2e');

      const NMS1 = 'network-management-system:nms-e2e-01';
      const SI1 = 'service-instance:si-e2e-01';
      // Each entry is the segments array followed by the expected icon path. A non-empty tuple
      // rather than string[]: treeRow's first segment is a required parameter, and only a tuple
      // type can be spread into one.
      const expectedIcons: [[string, ...string[]], string][] = [
        [[NMS1], `${ICON_BASE}/nms.svg`],
        [[NMS1, SI1], `${ICON_BASE}/service-instance.svg`],
        [[NMS1, SI1, 'generic-vnf:gvnf-e2e-enb'], `${ICON_BASE}/endb-node.svg`],
        [[NMS1, SI1, 'generic-vnf:gvnf-e2e-gnb'], `${ICON_BASE}/gndb-node.svg`],
        [[NMS1, SI1, 'generic-vnf:gvnf-e2e-bts'], `${ICON_BASE}/bts-node.svg`],
      ];

      for (const [segments, iconPath] of expectedIcons) {
        await expect(treeRow(page, ...segments).locator('img')).toHaveAttribute(
          'src',
          iconPath
        );
      }
    });

    test('gives each RAN node type a screen-reader label', async ({ page }) => {
      await searchTree(page, 'vnf-e2e');

      // The icon is the only thing distinguishing the types visually, so its alt text is the whole
      // of the non-visual affordance - an empty or shared alt would make the types indistinguishable
      // to a screen reader while still passing the icon test above.
      const NMS1 = 'network-management-system:nms-e2e-01';
      const SI1 = 'service-instance:si-e2e-01';
      const expectedAltText: [[string, ...string[]], string][] = [
        [[NMS1], 'network-management-system'],
        [[NMS1, SI1], 'RAN node'],
        [[NMS1, SI1, 'generic-vnf:gvnf-e2e-enb'], 'eNodeB'],
        [[NMS1, SI1, 'generic-vnf:gvnf-e2e-gnb'], 'gNodeB'],
        [[NMS1, SI1, 'generic-vnf:gvnf-e2e-bts'], 'BTS'],
      ];

      for (const [segments, altText] of expectedAltText) {
        await expect(treeRow(page, ...segments).locator('img')).toHaveAttribute(
          'alt',
          altText
        );
      }
    });

    test('labels the PNF and Cell types too', async ({ page }) => {
      await searchTree(page, 'Okruzni');

      const pnfRow = treeRow(
        page,
        'network-management-system:nms-e2e-01',
        'service-instance:si-e2e-02',
        'pnf:si-e2e-02'
      );
      const bbuLabel = pnfRow.locator('span').filter({ hasText: /\[BBU\]/ });

      await expect(bbuLabel).toBeVisible();
      await expect(bbuLabel).toHaveText(/\[BBU\].*/);

      // The Cell half needs a different fixture: a cell never appears in a search result, only at the
      // bottom of a revealed path. Its key does resolve, which is what makes the PNF line above a
      // missing-key finding rather than a wrong-namespace one.
      await page.goto(
        deepLinkUrl([
          {
            id: '445611193271828482',
            name: '84000009',
            serviceType: 'cell',
            aaiType: 'cell',
          },
        ])
      );

      await expect(page.locator('app-rat-view')).toBeVisible();

      // The cell row can only be visible once its ancestors are revealed and open, so this one
      // wait covers the whole reveal.
      const cellRow = treeRow(
        page,
        'network-management-system:nms-e2e-01',
        'service-instance:si-e2e-01',
        'pnf:pnf-e2e-01',
        'cell:445611193271828482'
      );
      await expect(cellRow).toBeVisible({ timeout: 30000 });

      const cellIcon = cellRow.locator('img');
      await expect(cellIcon).toHaveAttribute('src', `${ICON_BASE}/cell.svg`);
      await expect(cellIcon).toHaveAttribute('alt', 'Cell');
    });

    test('shows no expander on a node with no children', async ({ page }) => {
      await searchTree(page, 'leafcount');

      // The chevron is driven by childCount, and the contract says an absent count means zero.
      // null and 0 must both render a leaf; only a positive count gets an expander. A `> 0` check
      // on a null count coerces to false and looks correct, but `!= null ? … : children?.length`
      // is the guard that also survives a payload with neither field.
      await expect(
        treeRow(page, 'network-management-system:nms-leafcount-null')
      ).toBeVisible();
      await expect(
        toggleButton(page, 'network-management-system:nms-leafcount-null')
      ).toHaveCount(0);
      await expect(
        toggleButton(page, 'network-management-system:nms-leafcount-zero')
      ).toHaveCount(0);

      await expect(
        toggleButton(page, 'network-management-system:nms-leafcount-two')
      ).toHaveAttribute('aria-label', 'Expand');

      // aria-expanded is omitted on a leaf - a leaf reported as aria-expanded="false" announces a
      // closed branch that can never open. It is *also* omitted on the never-toggled parent, which is
      // a WAI-ARIA gap rather than intended behaviour: the library binds
      // `[attr.aria-expanded]="hasChildren ? isExpanded : undefined"` and mapToFinalData never emits
      // an isExpanded, so a collapsed branch is indistinguishable from a leaf to a screen reader
      // until it is opened once. Pinned as-is so a fix to the library shows up here as a failure
      // instead of going unnoticed; the visual chevron above is the only cue that survives today.
      await expect(
        treeRow(page, 'network-management-system:nms-leafcount-null')
      ).not.toHaveAttribute('aria-expanded');
      await expect(
        treeRow(page, 'network-management-system:nms-leafcount-two')
      ).not.toHaveAttribute('aria-expanded');
    });

    test('reports aria-expanded once a branch has been toggled', async ({
      page,
    }) => {
      // The other half of the gap above: from the first toggle onwards the attribute does track the
      // real state, so the round trip is what proves the binding is wired to the node and not to a
      // constant. nms-e2e-01 is used rather than a leafcount row because it is the one expandable
      // node with a /children stub - expanding an unstubbed parent leaves the row in its Loading
      // state and never reaches an expanded one.
      const parent = treeRow(page, 'network-management-system:nms-e2e-01');

      await toggleButton(page, 'network-management-system:nms-e2e-01').click();
      await expect(
        treeRow(
          page,
          'network-management-system:nms-e2e-01',
          'service-instance:si-e2e-01'
        )
      ).toBeVisible();
      await expect(parent).toHaveAttribute('aria-expanded', 'true');

      await toggleButton(page, 'network-management-system:nms-e2e-01').click();
      await expect(
        treeRow(
          page,
          'network-management-system:nms-e2e-01',
          'service-instance:si-e2e-01'
        )
      ).toHaveCount(0);
      await expect(parent).toHaveAttribute('aria-expanded', 'false');
    });

    test('never asks for the children of a childless node', async ({
      page,
    }) => {
      const childRequests: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/ran-treeview/children')) {
          childRequests.push(request.url());
        }
      });

      await searchTree(page, 'leafcount');
      const leaf = treeRow(
        page,
        'network-management-system:nms-leafcount-zero'
      );
      await expect(leaf).toBeVisible();

      // Activating a leaf row must not trigger a load: with no chevron there is no other way in,
      // and a childCount of 0 is the backend saying there is nothing to fetch.
      await leaf.click();
      await expectNoRequests(page, childRequests);
    });
  }
);
