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
import { technologyBadge, toggleButton, treeRow } from './rat-view.helpers';

// TNAP-30772 AC4 / AC4.1: the technology filter is the MVP tree's headline control. It must drive
// the `radioAccessTechnology` query param on *both* RAN endpoints - the root tree and every lazy
// /children call - otherwise a tree filtered to NR happily loads GSM children on expand.
//
// Runs under local-mvp only (see rat-view.mvp.spec.ts for why).

test.describe(
  'Tree View - RAT view technology filter',
  { tag: '@mvpOperator' },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/treeview');
      await expect(page.locator('app-rat-view')).toBeVisible();
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-01')
      ).toBeVisible();
    });

    test('starts on All with no technology param on the wire', async ({
      page,
    }) => {
      await expect(technologyBadge(page, 'All')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      for (const label of ['GSM', 'LTE', 'LTE-NB-IoT', 'NR']) {
        await expect(technologyBadge(page, label)).toHaveAttribute(
          'aria-pressed',
          'false'
        );
      }

      // The unfiltered tree is the default stub's three NMS roots.
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-02')
      ).toBeVisible();
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-03')
      ).toBeVisible();
    });

    test('reloads the tree with radioAccessTechnology when a technology is picked', async ({
      page,
    }) => {
      const treeRequests: string[] = [];
      page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/ran-treeview?')) {
          treeRequests.push(url);
        }
      });

      await technologyBadge(page, 'NR').click();

      // The rendered tree is the assertion, not the request: the NR stub serves one root, so the
      // other two disappearing proves the filtered response was applied rather than merged in.
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-01')
      ).toBeVisible();
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-02')
      ).toHaveCount(0);
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-03')
      ).toHaveCount(0);

      await expect(technologyBadge(page, 'NR')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(technologyBadge(page, 'All')).toHaveAttribute(
        'aria-pressed',
        'false'
      );

      await expect.poll(() => treeRequests.length).toBeGreaterThan(0);
      expect(treeRequests.at(-1)).toContain('radioAccessTechnology=NR');
    });

    test('carries the selected technology into lazily loaded children', async ({
      page,
    }) => {
      const childRequests: string[] = [];
      page.on('request', request => {
        const url = request.url();
        if (url.includes('/api/ran-treeview/children')) {
          childRequests.push(url);
        }
      });

      await technologyBadge(page, 'NR').click();
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-01')
      ).toBeVisible();

      await toggleButton(page, 'network-management-system:nms-e2e-01').click();

      // The NR-scoped children stub returns a node that exists in no other stub, so seeing it is
      // proof the filter reached the /children call. Without it the unfiltered stub would answer
      // and render si-e2e-01 / si-e2e-02 instead - the exact bug this test exists to catch.
      const NMS1 = 'network-management-system:nms-e2e-01';
      await expect(
        treeRow(page, NMS1, 'service-instance:si-e2e-nr')
      ).toBeVisible();
      await expect(
        treeRow(page, NMS1, 'service-instance:si-e2e-01')
      ).toHaveCount(0);
      await expect(
        treeRow(page, NMS1, 'service-instance:si-e2e-02')
      ).toHaveCount(0);

      await expect.poll(() => childRequests.length).toBe(1);
      expect(childRequests[0]).toContain('radioAccessTechnology=NR');
    });

    test('shows the empty state for a technology with no matches and recovers', async ({
      page,
    }) => {
      await technologyBadge(page, 'GSM').click();

      await expect(
        treeRow(page, 'network-management-system:nms-e2e-01')
      ).toHaveCount(0);
      await expect(page.locator('app-empty')).toBeVisible();

      // Back to All: the filter is a view over the same tree, not a destructive load.
      await technologyBadge(page, 'All').click();
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-01')
      ).toBeVisible();
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-02')
      ).toBeVisible();
    });

    test('is operable by keyboard', async ({ page }) => {
      // EN 301 549 9.2.1.1: the badges are div[role=button], so Enter and Space have to be wired
      // by hand - a native <button> would get them for free. Both are, so both are asserted.
      await technologyBadge(page, 'NR').press('Enter');
      await expect(technologyBadge(page, 'NR')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-02')
      ).toHaveCount(0);

      await technologyBadge(page, 'All').press(' ');
      await expect(technologyBadge(page, 'All')).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-02')
      ).toBeVisible();
    });
  }
);
