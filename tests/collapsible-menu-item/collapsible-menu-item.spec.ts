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

test.describe('CollapsibleMenuItemComponent', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('isLoggedIn', 'true');
    });

    await page.goto('/sidemenu');
    await page.waitForLoadState('domcontentloaded');
  });

  /*
   * The expanded state is asserted on the toggle button, not on the submenu container: the
   * container has no role, so `aria-expanded` on it is a WCAG failure (aria-allowed-attr)
   * and was removed. The button is the element that owns the state, and the container's
   * visibility is what a user actually observes — so both are checked here.
   */
  test('initial state should be collapsed', async ({ page }) => {
    const toggle = page.getByTestId('menu-toggle-btn').first();
    const submenu = page.getByTestId('submenu-container').first();

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(submenu).toBeHidden();
  });

  test('should expand on click', async ({ page }) => {
    const toggle = page.getByTestId('menu-toggle-btn').first();
    const submenu = page.getByTestId('submenu-container').first();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(submenu).toBeVisible();
  });

  test('should collapse on second click', async ({ page }) => {
    const toggle = page.getByTestId('menu-toggle-btn').first();
    const submenu = page.getByTestId('submenu-container').first();

    await toggle.click();
    await toggle.click();

    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(submenu).toBeHidden();
  });

  test('only one menu should stay open', async ({ page }) => {
    const toggles = page
      .getByTestId('menu-toggle-btn')
      .filter({ visible: true });

    await toggles.nth(0).click();
    await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'true');

    await toggles.nth(1).click();
    await expect(toggles.nth(1)).toHaveAttribute('aria-expanded', 'true');
    await expect(toggles.nth(0)).toHaveAttribute('aria-expanded', 'false');
  });

  test('should expand on Enter key', async ({ page }) => {
    const toggle = page.getByTestId('menu-toggle-btn').first();

    await toggle.focus();
    await page.keyboard.press('Enter');

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('should expand on Space key', async ({ page }) => {
    const toggle = page.getByTestId('menu-toggle-btn').first();

    await toggle.focus();
    await page.keyboard.press('Space');

    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  });

  test('icon should toggle', async ({ page }) => {
    const toggle = page.getByTestId('menu-toggle-btn').first();
    const icon = page.getByTestId('collapse-icon').first();

    await expect(icon).toHaveClass(/chevron-right/);
    await toggle.click();
    await expect(icon).toHaveClass(/chevron-down/);
  });

  test('should render child menu items', async ({ page }) => {
    const collapsibleItems = page.getByTestId('collapsible-menu-item');

    const firstWithChildren = collapsibleItems.first();
    await firstWithChildren.getByTestId('menu-toggle-btn').click();

    const children = firstWithChildren.getByTestId('child-menu');
    await expect(children).not.toHaveCount(0);
  });
});
