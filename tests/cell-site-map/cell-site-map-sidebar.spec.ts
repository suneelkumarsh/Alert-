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

import { expect, test } from '../../fixtures';

test.use({ locale: 'en' });

test.describe('Cell Site Map - sidebar and side panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
  });

  test('renders the icon rail with both panel buttons', async ({ page }) => {
    await expect(page.locator('.qa_map_sidebar')).toBeVisible();
    await expect(page.locator('.qa_map_sidebar_site_list')).toBeVisible();
    await expect(page.locator('.qa_map_sidebar_filters')).toBeVisible();
  });

  test('keeps the side panel closed until a rail button is used', async ({
    page,
  }) => {
    await expect(page.locator('.qa_side_panel_slot')).toHaveCount(0);
    await expect(page.locator('.qa_map_sidebar_filters')).toHaveAttribute(
      'aria-expanded',
      'false'
    );

    // Proves the slot selector is live, so the assertion above cannot pass
    // just because the class was renamed.
    await page.locator('.qa_map_sidebar_filters').click();

    await expect(page.locator('.qa_side_panel_slot')).toBeVisible();
  });

  test('opens and closes the filter panel from the rail', async ({ page }) => {
    await page.locator('.qa_map_sidebar_filters').click();

    await expect(page.locator('.qa_map_side_panel')).toBeVisible();
    await expect(page.locator('.qa_map_filter_panel')).toBeVisible();
    await expect(page.locator('.qa_rat-filter-header')).toBeVisible();
    await expect(page.locator('.qa_map_sidebar_filters')).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    await expect(page.locator('.qa_map_sidebar_filters')).toHaveAttribute(
      'aria-controls',
      'map-side-panel'
    );
    await expect(page.locator('.qa_map_sidebar_site_list')).not.toHaveAttribute(
      'aria-controls',
      'map-side-panel'
    );

    await page.locator('.qa_map_sidebar_filters').click();

    await expect(page.locator('.qa_map_side_panel')).toHaveCount(0);
  });

  test('closes the filter panel via the panel close button', async ({
    page,
  }) => {
    await page.locator('.qa_map_sidebar_filters').click();
    await expect(page.locator('.qa_map_side_panel')).toBeVisible();

    await page.locator('.qa_map_side_panel_close').click();

    await expect(page.locator('.qa_map_side_panel')).toHaveCount(0);
  });

  test('returns focus to the rail button after closing a panel', async ({
    page,
  }) => {
    const siteListButton = page.locator('.qa_map_sidebar_site_list');
    await siteListButton.click();
    await expect(page.locator('.qa_site_list_table')).toBeVisible();

    await page.locator('.qa_map_side_panel_close').click();
    await expect(siteListButton).toBeFocused();
  });

  test('closes the filter panel with the escape key', async ({ page }) => {
    await page.locator('.qa_map_sidebar_filters').click();

    // The panel takes the focus itself on open, so Escape must work without
    // moving the focus there manually.
    await expect(page.locator('.qa_map_side_panel')).toBeFocused();
    await page.keyboard.press('Escape');

    await expect(page.locator('.qa_map_side_panel')).toHaveCount(0);
  });

  test('shows the site list when the panel is opened', async ({ page }) => {
    await page.locator('.qa_map_sidebar_site_list').click();

    await expect(page.locator('.qa_site_list_table')).toBeVisible();
  });

  test('switches between the two panels', async ({ page }) => {
    await page.locator('.qa_map_sidebar_filters').click();
    await expect(page.locator('.qa_map_filter_panel')).toBeVisible();

    await page.locator('.qa_map_sidebar_site_list').click();

    await expect(page.locator('.qa_map_filter_panel')).toHaveCount(0);
    await expect(page.locator('.qa_site_list_table')).toBeVisible();
    await expect(page.locator('.qa_map_sidebar_filters')).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  test('rail buttons are operable via the keyboard', async ({ page }) => {
    await page.locator('.qa_map_sidebar_filters').focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('.qa_map_side_panel')).toBeVisible();
  });
});
