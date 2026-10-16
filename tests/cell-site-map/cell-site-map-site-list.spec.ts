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

test.describe('Cell Site Map - site list panel', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible({
      timeout: 30000,
    });
    await page.locator('.qa_map_sidebar_site_list').click();
    await expect(page.locator('.qa_site_list_table')).toBeVisible();
  });

  test('renders the site columns of the current viewport', async ({ page }) => {
    await expect(
      page.getByRole('columnheader', { name: 'Site ID' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Name' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Cells' })
    ).toBeVisible();
    // The address column is off by default in the narrow panel.
    await expect(
      page.getByRole('columnheader', { name: 'Address' })
    ).toHaveCount(0);
  });

  test('opens the site detail from a row', async ({ page }) => {
    const openDetail = page.locator('.qa_site_list_open_detail').first();
    await expect(openDetail).toBeVisible();

    await openDetail.click();

    await expect(page.locator('.qa_site_pane')).toBeVisible();
    await expect(page.locator('.qa_site_list_table')).toHaveCount(0);
  });

  // The close action dismisses the whole slot, the arrow only one level.
  test('closes the whole panel through the close button', async ({ page }) => {
    await page.locator('.qa_site_list_open_detail').first().click();
    await expect(page.locator('.qa_site_pane')).toBeVisible();

    await page.locator('.qa_close_button').click();

    await expect(page.locator('.qa_site_pane')).toHaveCount(0);
    await expect(page.locator('.qa_site_list_table')).toHaveCount(0);
  });

  test('returns to the site list through the back arrow', async ({ page }) => {
    await page.locator('.qa_site_list_open_detail').first().click();
    await expect(page.locator('.qa_site_pane')).toBeVisible();

    await page.locator('.qa_back_button').click();

    await expect(page.locator('.qa_site_list_table')).toBeVisible();
  });

  test('detail buttons are operable via the keyboard', async ({ page }) => {
    const openDetail = page.locator('.qa_site_list_open_detail').first();
    await openDetail.focus();
    await page.keyboard.press('Enter');

    await expect(page.locator('.qa_site_pane')).toBeVisible();
  });

  test('detail buttons carry an accessible name', async ({ page }) => {
    const openDetail = page.locator('.qa_site_list_open_detail').first();

    await expect(openDetail).toHaveAttribute('aria-label', /Show details/);
  });

  test('renders only one page of the 40 stubbed sites', async ({ page }) => {
    // One detail button per rendered row, default page size is 20.
    await expect(page.locator('.qa_site_list_open_detail')).toHaveCount(20);
    // The total is reported by the kit pagination, not by an own counter.
    await expect(page.locator('.qa_site_list_count')).toHaveCount(0);
    await expect(
      page.locator('.qa_site_list_table .paginationCount .count')
    ).toHaveText('40');
  });

  // The kit replaces the page numbers with a "<current> of <total>" status, so
  // paging happens through the direction links.
  test('shows the remaining sites on the second page', async ({ page }) => {
    const rows = page.locator('.qa_site_list_open_detail');
    const status = page.locator(
      '.qa_site_list_table .app-table-pagination-status'
    );
    await expect(status).toContainText(/1\s*of\s*2/);
    const firstSiteId = await rows.first().getAttribute('data-site-id');

    await page
      .locator('.qa_site_list_table')
      .getByRole('link', { name: /next/i })
      .click();

    await expect(status).toContainText(/2\s*of\s*2/);
    await expect(rows).toHaveCount(20);
    await expect(rows.first()).not.toHaveAttribute(
      'data-site-id',
      firstSiteId ?? ''
    );
  });
});
