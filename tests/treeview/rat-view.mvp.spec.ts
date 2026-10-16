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
  expectRequestsToSettleAt,
  toggleButton,
  treeRow,
} from './rat-view.helpers';

// Runs under the local-mvp project only: its storage state is mvp-operator, the sole
// user with mvp_operator / rat_view_resource. Without it treeview.component.html renders
// the node view instead and every assertion here fails.
//
// The row/toggle locators and the request-settling helper live in rat-view.helpers.ts, shared with
// every other *.mvp.spec.ts: the library's markup contract is easy to get subtly wrong (an
// `#treeitem-…` id selector silently matches nothing, because the composite key contains a colon),
// and a second hand-rolled copy would drift from it.

// Shared path segments — kept here rather than inlined so that a tree-structure change shows up
// as a single-location fix, not a grep across all assertions.
const NMS1 = 'network-management-system:nms-e2e-01';
const NMS3 = 'network-management-system:nms-e2e-03';
const SI1 = 'service-instance:si-e2e-01';
const SI2 = 'service-instance:si-e2e-02';
const PNF1 = 'pnf:pnf-e2e-01';
const PNF_SI2 = 'pnf:si-e2e-02';

test.describe(
  'Tree View - RAT view lazy loading',
  { tag: '@mvpOperator' },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/treeview');
      await expect(page.locator('app-rat-view')).toBeVisible();
    });

    test('loads only the root level on first render', async ({ page }) => {
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-01')
      ).toBeVisible();
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-02')
      ).toBeVisible();

      // Children are not fetched up front.
      await expect(treeRow(page, NMS1, SI1)).toHaveCount(0);
    });

    test('shows a chevron only for nodes that report children', async ({
      page,
    }) => {
      // childCount 2 in the stub → expandable; nms-e2e-02 has no childCount → leaf. The library
      // renders no toggle button at all for a leaf, so presence of the button is the assertion.
      // Not aria-expanded: the lib binds it to `hasChildren ? isExpanded : undefined`, and a
      // never-toggled node has isExpanded undefined, so the attribute is absent on a collapsed
      // parent and on a leaf alike — it cannot tell the two apart.
      await expect(
        toggleButton(page, 'network-management-system:nms-e2e-01')
      ).toHaveCount(1);
      await expect(
        toggleButton(page, 'network-management-system:nms-e2e-02')
      ).toHaveCount(0);
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-02')
      ).toBeVisible();
    });

    test('fetches one page of children per expand, three levels deep', async ({
      page,
    }) => {
      const childRequests: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/ran-treeview/children')) {
          childRequests.push(request.url());
        }
      });

      await toggleButton(page, NMS1).click();
      await expect(treeRow(page, NMS1, SI1)).toBeVisible();
      await expect(treeRow(page, NMS1, SI2)).toBeVisible();

      await toggleButton(page, NMS1, SI1).click();
      await expect(treeRow(page, NMS1, SI1, PNF1)).toBeVisible();

      // Poll rather than assert once: a duplicate request would arrive after the row is visible,
      // so a bare toHaveLength could pass before the extra request is even sent.
      await expect.poll(() => childRequests.length).toBe(2);
      expect(childRequests[0]).toContain('parentId=nms-e2e-01');
      expect(childRequests[1]).toContain('parentId=si-e2e-01');
    });

    test('does not refetch children when a node is collapsed and expanded again', async ({
      page,
    }) => {
      await toggleButton(page, NMS1).click();
      await expect(treeRow(page, NMS1, SI1)).toBeVisible();

      const childRequests: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/ran-treeview/children')) {
          childRequests.push(request.url());
        }
      });

      await toggleButton(page, NMS1).click();
      await expect(treeRow(page, NMS1, SI1)).toHaveCount(0);

      await toggleButton(page, NMS1).click();
      await expect(treeRow(page, NMS1, SI1)).toBeVisible();

      await expectRequestsToSettleAt(page, childRequests, 0);
    });

    test('does not refetch a node whose children came back empty', async ({
      page,
    }) => {
      // nms-e2e-03 advertises childCount 1 but its children stub returns none — a stale count,
      // which is the only way a user reaches an expanded-but-empty node. If the empty result is
      // not cached, every further click re-requests it.
      const childRequests: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/ran-treeview/children')) {
          childRequests.push(request.url());
        }
      });

      await toggleButton(page, NMS3).click();
      await expect(toggleButton(page, NMS3)).toHaveAttribute(
        'aria-label',
        'Collapse'
      );
      await expectRequestsToSettleAt(page, childRequests, 1);

      await toggleButton(page, NMS3).click();
      await toggleButton(page, NMS3).click();

      await expect(toggleButton(page, NMS3)).toHaveAttribute(
        'aria-label',
        'Collapse'
      );
      await expectRequestsToSettleAt(page, childRequests, 1);
    });

    test('retries a node whose children request failed once', async ({
      page,
    }) => {
      // A transient failure must not be cached as "no children" — otherwise the only way back is a
      // full tree reload. Fail the first request, then let the Wiremock stub answer the second.
      let failNext = true;
      await page.route('**/api/ran-treeview/children*', async route => {
        if (failNext) {
          failNext = false;
          await route.abort('failed');
        } else {
          await route.fallback();
        }
      });

      await toggleButton(page, NMS1).click();
      // Scoped by text: the failed request also trips the global HttpError interceptor, so a bare
      // ngb-alert locator matches two elements and fails strict mode.
      await expect(
        page.locator('ngb-alert', { hasText: 'child elements' })
      ).toBeVisible();
      await expect(treeRow(page, NMS1, SI1)).toHaveCount(0);

      // Collapse and re-expand is the retry.
      await toggleButton(page, NMS1).click();
      await toggleButton(page, NMS1).click();

      await expect(treeRow(page, NMS1, SI1)).toBeVisible();
    });

    test('shows the details of a lazily loaded node', async ({ page }) => {
      await toggleButton(page, 'network-management-system:nms-e2e-01').click();

      const node = page
        .locator('.qa_instance_node', { hasText: 'gnb-9239238' })
        .first();
      await expect(node).toBeVisible();
      await node.click();

      await expect(
        page.getByRole('heading', { level: 2, name: 'gnb-9239238' })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 3, name: 'General' }).first()
      ).toBeVisible();
    });

    test('renders a child whose id equals its parent as its own row', async ({
      page,
    }) => {
      // The do4 defect: AAI ids are unique only within a type, so a PNF can carry its parent
      // service instance's id. With a single flat id namespace the parent wins every
      // first-match-wins lookup and the child is unreachable — no row, no selection, no detail.
      await toggleButton(page, NMS1).click();
      await expect(treeRow(page, NMS1, SI2)).toBeVisible();

      await toggleButton(page, NMS1, SI2).click();

      const parent = treeRow(page, NMS1, SI2);
      const child = treeRow(page, NMS1, SI2, PNF_SI2);

      await expect(parent).toBeVisible();
      await expect(child).toBeVisible();
      await expect(parent).toHaveCount(1);
      await expect(child).toHaveCount(1);
      await expect(child).toContainText('As_Okruzni-A-84061');

      // Selecting the child must open the child's detail panel, not the parent's.
      await page
        .locator('.qa_instance_node', { hasText: 'As_Okruzni-A-84061' })
        .first()
        .click();

      await expect(
        page.getByRole('heading', { level: 2, name: 'As_Okruzni-A-84061' })
      ).toBeVisible();
    });

    test('opens the colliding pnf, not its parent, from a selectedNodes deep link', async ({
      page,
    }) => {
      const treeRequests: string[] = [];

      page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/ran-treeview?')) {
          treeRequests.push(url);
        }
      });

      const selectedNodes = [
        {
          id: 'si-e2e-02',
          name: 'As_Okruzni-A-84061',
          serviceType: 'pnf',
          aaiType: 'pnf',
        },
      ];

      await page.goto(
        `/treeview?selectedNodes=${encodeURIComponent(
          encodeURIComponent(JSON.stringify(selectedNodes))
        )}`
      );

      await expect(page.locator('app-rat-view')).toBeVisible({
        timeout: 15000,
      });

      await expect(
        page.getByRole('heading', { level: 2, name: 'As_Okruzni-A-84061' })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', { level: 2, name: 'gnb-9239239' })
      ).toHaveCount(0);

      // The revealed branch has to be open on first paint, without any click: applyRevealedPath
      // marks the ancestors isExpanded because preserveExpansionOnDataChange suppresses the lib's
      // own selection-driven expansion.
      await expect(treeRow(page, NMS1)).toBeVisible({ timeout: 30000 });
      await expect(treeRow(page, NMS1, SI2)).toBeVisible();
      await expect(treeRow(page, NMS1, SI2, PNF_SI2)).toBeVisible();
      await expect(treeRow(page, NMS1, SI2, PNF_SI2)).toHaveCount(1);
      await expect(toggleButton(page, NMS1)).toHaveAttribute(
        'aria-label',
        'Collapse'
      );
      await expect(toggleButton(page, NMS1, SI2)).toHaveAttribute(
        'aria-label',
        'Collapse'
      );

      // The sibling branch stays shut - a reveal opens one path, not the whole tree.
      await expect(treeRow(page, NMS1, SI1, PNF1)).toHaveCount(0);

      // The id and the type have to travel separately, or the backend probes types in a fixed
      // order and resolves the parent service instance instead.
      await expect.poll(() => treeRequests.length).toBeGreaterThan(0);
      expect(treeRequests.at(-1)).toContain('revealNodeId=si-e2e-02');
      expect(treeRequests.at(-1)).toContain('revealNodeType=pnf');
    });
  }
);
