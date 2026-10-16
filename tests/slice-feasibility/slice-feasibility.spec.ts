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

test.describe('Slice Feasibility - Table Data Visibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/slice-management/slice-history');
    const rows = page.locator('table tbody tr:not(.loading-row)');
    await expect(rows).toHaveCount(20);
  });

  test('should show the slice history table rows', async ({ page }) => {
    // Column headers visible
    await expect(
      page.getByRole('columnheader', { name: 'Date of Check' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Job Name' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Latitude' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Longitude' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Feasibility Result' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Reason' })
    ).toBeVisible();

    await expect(page.getByLabel('Select number of items per')).toBeVisible();
    await expect(page.getByText('Total Count:')).toBeVisible();
    await expect(page.getByText('of 1')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Next' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Last' })).toBeVisible();
  });

  test('should display expected job names', async ({ page }) => {
    await expect(
      page.getByRole('cell', { name: /e2e-feas-3-0401/i })
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: /Testing21/i })).toBeVisible();
  });

  test('should show feasibility result badges', async ({ page }) => {
    // Feasible (green)
    await expect(
      page.getByRole('cell', { name: 'Feasible' }).first()
    ).toBeVisible();

    // Infeasible (red)
    await expect(
      page.getByRole('cell', { name: 'Infeasible' }).first()
    ).toBeVisible();
  });

  test('should show feasibility result badges with correct styles', async ({
    page,
  }) => {
    await expect(page.locator('.tnap-badge--success').first()).toContainText(
      'Feasible'
    );

    await expect(page.locator('.tnap-badge--danger').first()).toContainText(
      'Infeasible'
    );
  });

  test('Slice Feasibility - Request tab displays correct feasibility job details', async ({
    page,
  }) => {
    await page.goto(
      '/slice-management/slice-history?feasibilityJobId=c723083e-bf9d-47f2-9e95-c373be917170'
    );
    await expect(
      page.getByTitle('Feasibility Check and Reservation Job ID')
    ).toBeVisible();
    await expect(
      page.getByText('c723083e-bf9d-47f2-9e95-c373be917170', { exact: true })
    ).toBeVisible();

    await expect(page.getByTitle('Job Name')).toBeVisible();

    await expect(
      page.locator('dt.key:has-text("Job Name") + dd .value-text')
    ).toContainText('TC_SR6_1');

    await expect(page.getByTitle('Date of Check')).toBeVisible();
    await expect(
      page.locator('dt.key:has-text("Date of Check") + dd .value-text')
    ).toContainText('Mon 06. Apr 12:43');

    await expect(page.getByTitle('Start Date')).toBeVisible();
    await expect(
      page.locator('dt.key:has-text("Start Date") + dd .value-text')
    ).toContainText('2026-12-31T12:00:00.000Z');
    await expect(
      page.getByText('2026-12-31T12:00:00.000Z', { exact: true })
    ).toBeVisible();
    await expect(page.getByTitle('End Date')).toBeVisible();
    await expect(
      page.locator('dt.key:has-text("End Date") + dd .value-text')
    ).toContainText('2026-12-31T14:00:00.000Z');
    await expect(
      page.getByText('2026-12-31T14:00:00.000Z', { exact: true })
    ).toBeVisible();
    await expect(page.getByTitle('Latitude')).toBeVisible();
    await expect(
      page.locator('dt.key:has-text("Latitude") + dd .value-text')
    ).toContainText('48.36581039428711');
    await expect(page.getByTitle('Longitude')).toBeVisible();
    await expect(
      page.locator('dt.key:has-text("Longitude") + dd .value-text')
    ).toContainText('10.886249542236328');
  });

  test('should navigate to treeview when a Cell ID is clicked in detail', async ({
    page,
  }) => {
    await page.goto(
      '/slice-management/slice-history?feasibilityJobId=c723083e-bf9d-47f2-9e95-c373be917170'
    );

    await page.getByRole('tab', { name: 'Cell Feasibility' }).click();

    const cellIdLink = page
      .locator('.qa_open_treeview_from_cell_detail')
      .first();
    await expect(cellIdLink).toBeVisible();

    const firstCellIdText = (await cellIdLink.textContent())?.trim();
    expect(firstCellIdText).toBe('445611193277149441');

    await cellIdLink.click();
    await page.waitForURL(url => {
      const targetUrl = new URL(url);
      return (
        targetUrl.pathname === '/treeview' &&
        targetUrl.searchParams.get('filter') === firstCellIdText &&
        targetUrl.searchParams.get('select') === 'true'
      );
    });
  });

  test('should show a translated Infeasible badge per cell in the Cell Feasibility tab', async ({
    page,
  }) => {
    await page.goto(
      '/slice-management/slice-history?feasibilityJobId=c723083e-bf9d-47f2-9e95-c373be917170'
    );

    await page.getByRole('tab', { name: 'Cell Feasibility' }).click();

    const badges = page.locator('.qa_cell_feasible_badge');
    await expect(badges).toHaveCount(2);

    for (const badge of await badges.all()) {
      await expect(badge).toHaveText('Infeasible');
      await expect(badge.locator('span')).toHaveClass(/tnap-badge--danger/);
    }
  });

  test('should filter table rows after search API triggers', async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder('Search attribute...');
    await expect(searchInput).toBeVisible();
    //  Type search term (triggers API call)
    await searchInput.fill('slice-qual-200');
    // Locate ALL rows after filtering
    const rows = page.locator('table tbody tr:not(.loading-row)');
    await expect(rows).toHaveCount(1);
    const jobNameCells = page.locator(
      'table tbody tr:not(.loading-row) td:nth-child(2)'
    );
    const jobNames = await jobNameCells.allTextContents();
    //  Every filtered row must contain the search value
    for (const job of jobNames) {
      expect(job.toLowerCase()).toContain('slice-qual-200');
    }
  });

  test('should filter table rows when Feasible filter is selected', async ({
    page,
  }) => {
    const dropdown = page.locator('#feasibilityResultSelect select');
    await expect(dropdown).toBeVisible();

    // Select option properly
    await dropdown.selectOption({ label: 'Feasible' });
    // Verify filtered table
    const rows = page.locator('table tbody tr:not(.loading-row)');
    await expect(rows).toHaveCount(14);
  });

  test('should filter table rows when InFeasible filter is selected', async ({
    page,
  }) => {
    const dropdown = page.locator('#feasibilityResultSelect select');
    await expect(dropdown).toBeVisible();

    // Select option properly
    await dropdown.selectOption({ label: 'Infeasible' });
    // Verify filtered table
    const rows = page.locator('table tbody tr:not(.loading-row)');
    await expect(rows).toHaveCount(5);
  });
});
