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

test.describe('Slice List - Data can is visible', () => {
  test('Slice List - Slice List table data is visible', async ({ page }) => {
    await page.goto('/slice-management/slice-list');

    // Check key table cells with essential data
    const firstRow = page.getByRole('row').filter({ hasText: '202' }).first();
    await expect(firstRow).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Feasible' }).first()
    ).toBeVisible();
    await expect(
      page.getByRole('cell', { name: 'Active' }).first()
    ).toBeVisible();

    // Check action buttons for the first row
    await expect(firstRow.getByLabel('Terminate Slice')).toBeVisible();
    await expect(firstRow.getByLabel('Reinforce Slice')).toBeVisible();
    await expect(
      firstRow.getByLabel('Show entry in topology view')
    ).toBeVisible();

    // Check pagination controls
    await expect(page.getByText('Total Count')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Next' })).toBeVisible();
  });

  test('Slice List - Slice list detail tabs are visible', async ({ page }) => {
    await page.goto('/slice-management/slice-list');
    const row = page.getByRole('row').filter({ hasText: '202' }).first();
    await row.getByLabel('Show details').click();
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Feasibility' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Details' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'CM Actions' })).toBeVisible();
  });

  test('Slice List - Slice detail tabs contain expected data', async ({
    page,
  }) => {
    const sliceUrl =
      '/slice-management/slice-list?sliceId=0377b1fc-4d2b-4db6-87bd-5a60fc103530';
    await page.goto(sliceUrl);

    // Overview tab
    await expect(page.getByTitle('S-NSSAI')).toBeVisible();
    await expect(page.getByText('ACTIVE', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('cell', { name: '84000009', exact: true })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open Cell 84000009 in Treeview' })
    ).toBeVisible();

    // Feasibility tab
    await page.getByRole('tab', { name: 'Feasibility' }).click();
    await expect(page.getByTitle('Job Name')).toBeVisible();
    await expect(
      page.locator('dt.key:has-text("Job Name") + dd .value-text')
    ).toContainText('202');
    await expect(page.getByTitle('Latitude')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Cell Feasibility' })
    ).toBeVisible();
    await expect(
      page.locator('dt:has-text("Cell ID") + dd').first()
    ).toContainText('445611193271828482');

    const feasibleBadges = page.locator('.qa_cell_feasible_badge');
    await expect(feasibleBadges).toHaveCount(2);
    for (const badge of await feasibleBadges.all()) {
      await expect(badge).toHaveText('Feasible');
      await expect(badge.locator('span')).toHaveClass(/tnap-badge--success/);
    }

    // Details tab
    await page.getByRole('tab', { name: 'Details' }).click();
    await expect(page.getByText('Profile ID', { exact: true })).toBeVisible();

    // CM Actions tab
    await page.getByRole('tab', { name: 'CM Actions' }).click();
    await expect(
      page.getByRole('cell', { name: 'Activation completed' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open CM Action Details' })
    ).toBeVisible();
  });
});

test.describe('Slice List - interaction is possible', () => {
  test('Slice actions work correctly', async ({ page }) => {
    await page.goto('/slice-management/slice-list');

    // Test terminate action
    await page.locator('tr:nth-child(1) .qa_active_terminate').click();
    await expect(page.getByRole('button', { name: 'Yes' })).toBeVisible();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(
      page.getByText('The terminate job was successfully initiated')
    ).toBeVisible();

    // Test reinforce action
    await page.locator('tr:nth-child(1) .qa_terminated_reinforce').click();
    await expect(page.getByText('Confirm Reinforce?')).toBeVisible();
    await page.getByRole('button', { name: 'Yes' }).click();
    await expect(page.getByText('The reinforce job was')).toBeVisible();
  });

  test('Navigation works correctly', async ({ page }) => {
    await page.goto('/slice-management/slice-list');

    // Test topology view redirect
    await page.locator('tr:nth-child(1) .qa_view_topology').click();
    await page.waitForURL(/.*\/topology.*/);

    // Test treeview redirect from cell
    await page.goto('/slice-management/slice-list');
    const row = page.getByRole('row').filter({ hasText: '202' }).first();

    await row.getByLabel('Show details').click();
    await page
      .getByRole('button', { name: 'Open Cell 84000009 in Treeview' })
      .click();
    await page.waitForURL(/.*\/treeview.*selectedNodes=.*/);

    // TNAP-30342 AC3: the URL is not the deliverable - the cell's details are. openTreeview()
    // encodes selectedNodes once and the router adds a second layer, so the link only works if
    // both ends agree on the encoding; a mismatch still produces a matching URL and lands on an
    // empty treeview, which is exactly what the waitForURL above cannot see.
    await expect(
      page.getByRole('heading', { level: 2, name: '84000009' })
    ).toBeVisible();
    // …and the cell's own data, not just its name echoed back from the URL. n78 comes from the
    // cell stub, so it can only render if the treeview resolved the node it was handed.
    const detail = page.locator('app-treeview-detail');
    await expect(
      detail.getByRole('tab', { name: 'Cell', exact: true })
    ).toHaveAttribute('aria-selected', 'true');
    await expect(detail).toContainText('n78');
  });

  test('Slice List - keyboard focus moves into and back from slice detail', async ({
    page,
  }) => {
    await page.goto(
      '/slice-management/slice-list?sliceId=0377b1fc-4d2b-4db6-87bd-5a60fc103530'
    );
    const detailHeading = page.locator('#details-title');
    await expect(detailHeading).toBeVisible();
    await expect(detailHeading).toBeFocused();
    await page.keyboard.press('Escape');
    const focusLeftDetail = await page.evaluate(() => {
      return !document.activeElement?.closest('.detail-wrapper');
    });
    expect(focusLeftDetail).toBe(true);
    await expect(page.getByRole('table')).toBeVisible();
  });
});
