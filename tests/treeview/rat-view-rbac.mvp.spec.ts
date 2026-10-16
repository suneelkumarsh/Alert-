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
import { deepLinkUrl, treeRow } from './rat-view.helpers';

// TNAP-25354 AC6 / TNAP-30772 AC2 + AC2.1 + AC5 + AC6: which tree a session gets, and which detail
// tabs come with it, is decided purely by Keycloak authorization. treeview.component.html gates on
// an *exclusive* @if (VIEW_RAT_VIEW) - so this file asserts the RAT side of that fork, and
// treeview-tree-mode.spec.ts asserts the node-view side under the `local` project.
//
// The failure this guards against is a permission-name typo: the resource string in
// permissions.config.ts has to match the realm's resource exactly, and a mismatch resolves to
// "denied" - silently serving the wrong tree with every other assertion in the suite still green.
//
// Runs under local-mvp only (see rat-view.mvp.spec.ts for why).

test.describe(
  'Tree View - RAT view RBAC and layout',
  { tag: '@mvpOperator' },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/treeview');
      await expect(page.locator('app-rat-view')).toBeVisible();
    });

    test('serves the RAT tree and not the node tree', async ({ page }) => {
      await expect(
        treeRow(page, 'network-management-system:nms-e2e-01')
      ).toBeVisible();

      // The @if is exclusive, so exactly one of the two components exists. Without the count-0 half
      // a build that renders both - or renders the node view and happens to load the same stub -
      // passes every other RAT assertion in this directory.
      await expect(page.locator('app-node-view')).toHaveCount(0);
      await expect(page.locator('app-rat-view')).toHaveCount(1);
    });

    test('offers no tree-mode selector', async ({ page }) => {
      // AC2 removed the logical/physical switch: the RAT tree is the only tree an mvp_operator gets.
      // A leftover control would let a user switch to a view their permissions do not cover, so its
      // absence is asserted structurally rather than by grepping the source.
      const treePane = page.locator('app-rat-view');
      await expect(treePane.getByRole('combobox')).toHaveCount(0);
      await expect(treePane.getByRole('radiogroup')).toHaveCount(0);
      await expect(treePane.getByRole('tablist')).toHaveCount(0);

      // The only role=group in the pane is the technology filter - not a view switcher.
      const groups = treePane.getByRole('group');
      await expect(groups).toHaveCount(1);
      await expect(groups).toHaveClass(/qa_rat_technology_filter/);
    });

    test('hides the AAI tab from a user without the AAI permission', async ({
      page,
    }) => {
      await page.goto(
        deepLinkUrl([
          {
            id: 'pnf-e2e-01',
            name: 'bbu-gnb-9239238',
            serviceType: 'pnf',
            aaiType: 'pnf',
          },
        ])
      );
      const detail = page.locator('app-treeview-detail');
      await expect(
        page.getByRole('heading', { level: 2, name: 'bbu-gnb-9239238' })
      ).toBeVisible();

      // AC5: the AAI tab needs VIEW_TREEVIEW_AAI -> `treeview_aai_ui_resource`, which no e2e user
      // holds (the resource is not in tnap-realm.yaml at all). The positive case is therefore not
      // reachable from here; what *is* worth locking down is that the tab is gone rather than
      // present-but-broken, and that its absence does not shift the tab that follows it.
      await expect(detail.getByRole('tab', { name: 'AAI' })).toHaveCount(0);
      await expect(detail.locator('.qa_aai_tab_name')).toHaveCount(0);
      await expect(detail.getByRole('tab', { name: 'pNF' })).toHaveCount(1);
    });

    test('renders the detail tabs in the documented order for a PNF', async ({
      page,
    }) => {
      await page.goto(
        deepLinkUrl([
          {
            id: 'pnf-e2e-01',
            name: 'bbu-gnb-9239238',
            serviceType: 'pnf',
            aaiType: 'pnf',
          },
        ])
      );
      const detail = page.locator('app-treeview-detail');
      await expect(
        page.getByRole('heading', { level: 2, name: 'bbu-gnb-9239238' })
      ).toBeVisible();

      // AC6 is about DOM order, which is *not* the ngbNavItem numbering - the ids run 3, 4, 0, 1, 8,
      // 2, 5, 6, 7 down the template. Reordering the <li>s while keeping the ids is a silent change
      // no id-based or class-based assertion notices, so the rendered accessible names are compared
      // as a sequence.
      //
      // Two tabs are missing from this list because this realm cannot grant them: AAI needs
      // `treeview_aai_ui_resource` and Alarms needs `alarm_resource`, neither of which exists in
      // tnap-realm.yaml. Software and CM Actions *are* here - their resources resolve through
      // policies that accept `portal_operator`, which e2e-rat-operator holds.
      await expect(detail.getByRole('tab')).toHaveText([
        'pNF',
        'Slices',
        'Plan',
        'Network',
        'Software',
        'CM Actions',
      ]);
    });

    test('hides only the tabs whose resource the realm does not grant', async ({
      page,
    }) => {
      await page.goto(
        deepLinkUrl([
          {
            id: 'pnf-e2e-01',
            name: 'bbu-gnb-9239238',
            serviceType: 'pnf',
            aaiType: 'pnf',
          },
        ])
      );
      const detail = page.locator('app-treeview-detail');
      await expect(
        page.getByRole('heading', { level: 2, name: 'bbu-gnb-9239238' })
      ).toBeVisible();

      // HasPermissionsDirective sets `display: none` instead of removing the element, and it does so
      // from an async subscription - so the <li> is briefly visible before the verdict lands. Both
      // halves are asserted here to pin down which mechanism is being relied on: a role query skips
      // ARIA-hidden elements, so the tab is gone from the a11y tree, but it is still in the DOM and a
      // plain `.qa_alarms_tab_name` locator would find it.
      await expect(detail.getByRole('tab', { name: 'Alarms' })).toHaveCount(0);
      await expect(detail.locator('.qa_alarms_tab_name')).toBeHidden();

      // The converse: these two are not hidden, so a change that broke the directive outright (never
      // showing anything) would fail here rather than quietly satisfying the assertions above.
      await expect(detail.getByRole('tab', { name: 'Software' })).toHaveCount(
        1
      );
      await expect(detail.getByRole('tab', { name: 'CM Actions' })).toHaveCount(
        1
      );
    });

    test('opens the type-details tab first, not the tab with id 0', async ({
      page,
    }) => {
      await page.goto(
        deepLinkUrl([
          {
            id: 'pnf-e2e-01',
            name: 'bbu-gnb-9239238',
            serviceType: 'pnf',
            aaiType: 'pnf',
          },
        ])
      );
      const detail = page.locator('app-treeview-detail');

      // activeTab starts at 0 (= Slices) and setDefaultActiveTab() moves it to 3 (= the type-details
      // tab) only after the node fetch succeeds. So a broken detail fetch shows up as the Slices tab
      // being active - which is a plausible-looking pane, not an error.
      await expect(detail.getByRole('tab', { name: 'pNF' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      await expect(detail.getByRole('tab', { name: 'Slices' })).toHaveAttribute(
        'aria-selected',
        'false'
      );
    });
  }
);
