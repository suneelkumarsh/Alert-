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

import { test, expect, Page } from '../../fixtures';
import { deepLinkUrl, toggleButton, treeRow } from './rat-view.helpers';

// TNAP-26046 AC1 + AC2 + AC3 + AC4: the works-council accessibility gate for the tree.
//
// The tree is a WAI-ARIA composite widget, which means keyboard support is a *product contract*,
// not a styling detail: the whole subtree is one tab stop, arrow keys move a virtual focus inside
// it, and only an explicit activation selects. Every one of those rules is invisible to a
// screenshot and to every other test in this directory - a regression that makes each row its own
// tab stop, or that selects on mere focus, looks perfectly fine on screen.
//
// It is asserted here against the *rendered* markup rather than against the library's source
// because the app supplies the tree through `@portal-mfe/ng-tree-lib` from Artifactory: a library
// bump can change the contract without a single line of this repo changing, and this file is the
// only thing that would notice.
//
// Runs under local-mvp only (see rat-view.mvp.spec.ts for why).

const NMS_1 = 'network-management-system:nms-e2e-01';
const NMS_2 = 'network-management-system:nms-e2e-02';
/** Last root row in the stub — the target of `End`, and the reason it is not NMS_2. */
const NMS_3 = 'network-management-system:Huawei-Unassigned';
/** The first child of NMS_1, as one path segment — pass it to `treeRow` after its ancestor. */
const SI_1_SEG = 'service-instance:si-e2e-01';
/**
 * The same node's full composed id. Only needed where the raw attribute value is asserted
 * (`aria-activedescendant`); locators take the segments separately so the joining rule stays in
 * `treeRow`.
 */
const SI_1 = `${NMS_1}/${SI_1_SEG}`;

/** The library's focus container: the one element in the tree that is in the tab order. */
function treeWrapper(page: Page) {
  return page.locator('app-rat-view .tree-wrapper');
}

/**
 * The row the tree currently considers focused.
 *
 * Read from `aria-activedescendant` on the wrapper rather than from `document.activeElement`,
 * because that is the whole point of the pattern: DOM focus never leaves the wrapper, so a
 * `toBeFocused()` on a row would fail even when the widget is behaving correctly. This is also
 * exactly what a screen reader follows.
 */
function activeDescendant(page: Page) {
  return treeWrapper(page).getAttribute('aria-activedescendant');
}

test.describe(
  'Tree View - RAT tree accessibility',
  { tag: '@mvpOperator' },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/treeview');
      await expect(page.locator('app-rat-view')).toBeVisible();
      await expect(treeRow(page, NMS_1)).toBeVisible();
    });

    test('announces a load through a status region beside the tree', async ({
      page,
    }) => {
      // Both loads replace rows without moving focus or navigating, so nothing else tells a
      // screen-reader user that anything happened. The region has to sit outside the tree: an
      // aria-live on the tree itself re-announces every row that scrolls into the rendered window.
      const status = page.locator('.qa_tree_status');
      await expect(status).toHaveAttribute('role', 'status');
      // A regex rather than the stub's exact count, which is not what this asserts - an
      // uninterpolated message would render the count as empty.
      await expect(status).toHaveText(/Tree updated: \d+ top-level elements/);

      await toggleButton(page, NMS_1).click();
      await expect(treeRow(page, NMS_1, SI_1_SEG)).toBeVisible();
      await expect(status).toHaveText(/\d+ elements loaded under mae-east/);
    });

    test('is a single tab stop that never lands on an expander', async ({
      page,
    }) => {
      // D-1. A tree with 3000 lazily loaded rows must not put 3000 chevrons in the tab order -
      // that is the requirement, and it is the reason the rows are driven by
      // aria-activedescendant instead of by real focus.
      const toggles = page.locator('app-rat-view .toggle-btn');
      await expect(toggles.first()).toBeVisible();
      for (const tabindex of await toggles.evaluateAll(els =>
        els.map(el => el.getAttribute('tabindex'))
      )) {
        expect(tabindex).toBe('-1');
      }

      // Rows are likewise removed from the tab order; only the focused one is reachable, and only
      // as the container's proxy.
      await expect(treeRow(page, NMS_1)).toHaveAttribute('tabindex', '-1');

      // Focusing the container hands the virtual focus to the first row rather than leaving the
      // widget in a state where the first arrow press is swallowed.
      await treeWrapper(page).focus();
      await expect(treeRow(page, NMS_1)).toHaveClass(/focus/);
      expect(await activeDescendant(page)).toBe(`treeitem-${NMS_1}`);

      // Tab from inside the tree leaves the whole widget in one press. app-resizer is the next
      // tabbable in DOM order, so if a chevron or a row were tabbable this would stop short of it.
      await page.keyboard.press('Tab');
      await expect(page.locator('app-resizer')).toBeFocused();

      // And backwards out the other side: the last technology chip. Between it and the tree sit
      // every toggle button in the rendered window, all of which must be skipped.
      await treeWrapper(page).focus();
      await page.keyboard.press('Shift+Tab');
      await expect(
        page.locator('.qa_rat_technology_filter tnap-badge').last()
      ).toBeFocused();
    });

    test('moves through the tree and opens branches with the arrow keys', async ({
      page,
    }) => {
      // D-2 for the tree: arrow keys are the only way to reach a child row without a mouse, since
      // the rows are not tab stops (test above). Expansion is also lazy here, so ArrowRight has to
      // trigger the fetch, not merely reveal already-loaded rows.
      await treeWrapper(page).focus();

      // ArrowRight on a collapsed branch opens it and leaves the virtual focus on the parent - the
      // WAI-ARIA rule that lets a user open a branch and read its size before descending.
      await page.keyboard.press('ArrowRight');
      await expect(treeRow(page, NMS_1, SI_1_SEG)).toBeVisible();
      expect(await activeDescendant(page)).toBe(`treeitem-${NMS_1}`);
      await expect(treeRow(page, NMS_1)).toHaveAttribute(
        'aria-expanded',
        'true'
      );

      await page.keyboard.press('ArrowDown');
      expect(await activeDescendant(page)).toBe(`treeitem-${SI_1}`);

      // ArrowLeft on a child goes to its parent; ArrowLeft again closes the branch. Two different
      // behaviours behind one key, and getting them the wrong way round traps a keyboard user
      // inside an expanded subtree.
      await page.keyboard.press('ArrowLeft');
      expect(await activeDescendant(page)).toBe(`treeitem-${NMS_1}`);
      await page.keyboard.press('ArrowLeft');
      await expect(treeRow(page, NMS_1, SI_1_SEG)).toHaveCount(0);
      await expect(treeRow(page, NMS_1)).toHaveAttribute(
        'aria-expanded',
        'false'
      );

      // End/Home reach the ends of the visible tree without N arrow presses - the requirement that
      // makes a long lazy tree usable at all.
      await page.keyboard.press('End');
      expect(await activeDescendant(page)).toBe(`treeitem-${NMS_3}`);
      await page.keyboard.press('Home');
      expect(await activeDescendant(page)).toBe(`treeitem-${NMS_1}`);
    });

    test('selects a row only on activation, not on focus', async ({ page }) => {
      // D-3. Selecting on focus is the classic failure of this widget: it makes arrow-key browsing
      // impossible, because every row a user passes over loads its detail pane and re-renders the
      // page under them.
      await expect(treeRow(page, NMS_1)).toHaveAttribute(
        'aria-selected',
        'false'
      );
      await expect(treeRow(page, NMS_2)).toHaveAttribute(
        'aria-selected',
        'false'
      );

      await treeWrapper(page).focus();
      await page.keyboard.press('ArrowDown');
      expect(await activeDescendant(page)).toBe(`treeitem-${NMS_2}`);

      // Focused but still unselected - asserted globally, so a build that selects on focus fails
      // here no matter which row it picked.
      await expect(treeRow(page, NMS_2)).toHaveClass(/focus/);
      await expect(
        page.locator('[role="treeitem"][aria-selected="true"]')
      ).toHaveCount(0);

      await page.keyboard.press('Enter');
      await expect(treeRow(page, NMS_2)).toHaveAttribute(
        'aria-selected',
        'true'
      );
      // Single-select: Enter on a second row must move the selection, not add to it.
      await expect(
        page.locator('[role="treeitem"][aria-selected="true"]')
      ).toHaveCount(1);
    });

    test('keeps the detail tab bar operable from the keyboard', async ({
      page,
    }) => {
      // D-2 for the second composite widget the treeview page ships: the detail pane's tab bar.
      // ngb-nav's own keyboard handling is switched off ([keyboard]="false") and replaced by the
      // in-house tnapKeyboardNav directive, so nothing upstream guarantees this works.
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

      const tabFor = (name: string) => detail.getByRole('tab', { name });
      await tabFor('pNF').focus();

      // Arrow keys move focus along the bar. The next tab in DOM order is Slices, so this also
      // pins that the directive walks the rendered order rather than ngb's internal id order
      // (the ids are 0,3,4,1,… here - see rat-view-rbac.mvp.spec.ts).
      await page.keyboard.press('ArrowRight');
      await expect(tabFor('Slices')).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(tabFor('pNF')).toBeFocused();

      // Wrapping backwards past the start must land on CM Actions, the last *visible* tab. The
      // Alarms tab sits between it and Software but is permission-hidden with display:none, and a
      // hidden tab that still takes focus is a keyboard trap - the user presses a key and nothing
      // appears to happen.
      await page.keyboard.press('ArrowLeft');
      await expect(tabFor('CM Actions')).toBeFocused();
      await page.keyboard.press('ArrowLeft');
      await expect(tabFor('Software')).toBeFocused();

      await page.keyboard.press('End');
      await expect(tabFor('CM Actions')).toBeFocused();
      await page.keyboard.press('Home');
      await expect(tabFor('pNF')).toBeFocused();

      // Focus alone must not switch tabs: this is a manual-activation tab bar, and each panel here
      // triggers its own downstream fetch, so arrowing across the bar would fire every one of them.
      await page.keyboard.press('ArrowRight');
      await expect(tabFor('Slices')).toBeFocused();
      await expect(tabFor('pNF')).toHaveAttribute('aria-selected', 'true');
      await expect(tabFor('Slices')).toHaveAttribute('aria-selected', 'false');

      await page.keyboard.press('Enter');
      await expect(tabFor('Slices')).toHaveAttribute('aria-selected', 'true');
      await expect(tabFor('pNF')).toHaveAttribute('aria-selected', 'false');
    });
  }
);
