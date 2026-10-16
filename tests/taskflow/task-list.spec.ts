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

test.describe('Task list page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('tasks-table'));
    await page.goto('/task-flow/tasks');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tasks' })
    ).toBeVisible();
  });

  test('shows the page header', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tasks' })
    ).toHaveText('Tasks');
  });

  test('renders the task table with expected column headers', async ({
    page,
  }) => {
    await expect(page.locator('.qa_configurations_table')).toBeVisible();

    await expect(
      page.getByRole('columnheader', { name: 'Name' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Version' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Type' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Status' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Actions' })
    ).toBeVisible();
  });

  test('renders task rows from the API', async ({ page }) => {
    await expect(page.locator('.qa_configurations_table')).toBeVisible();
    const rows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row):not(.no-data-row)'
    );
    await expect(rows.first()).toBeVisible({
      timeout: 10000,
    });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);
  });

  test('renders filter controls', async ({ page }) => {
    await expect(page.locator('.qa_filter_type')).toBeVisible();
    await expect(page.locator('.qa_filter_status')).toBeVisible();
    await expect(page.locator('.qa_filter_search')).toBeVisible();
    await expect(page.locator('.qa_create_task_button')).toBeVisible();
  });

  test('renders action buttons in each row', async ({ page }) => {
    const firstRow = page
      .locator('.qa_configurations_table tbody tr:not(.loading-row)')
      .first();
    await expect(firstRow).toBeVisible();

    await expect(firstRow.locator('.qa_details_button')).toBeVisible();
    await expect(firstRow.locator('.qa_edit_button')).toBeVisible();
  });

  test('filters table rows via search input', async ({ page }) => {
    const rows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row):not(.no-data-row)'
    );
    await expect(rows.first()).toBeVisible();

    const initialCount = await rows.count();
    expect(initialCount).toBeGreaterThan(0);

    const firstTaskName = (
      await rows.first().locator('td').first().textContent()
    )?.trim();
    expect(firstTaskName).toBeTruthy();

    await page.locator('.qa_filter_search input').fill(firstTaskName as string);

    await expect
      .poll(async () => await rows.count())
      .toBeLessThanOrEqual(initialCount);
    await expect(rows.first().locator('td').first()).toContainText(
      firstTaskName as string
    );
  });

  test('resets search and shows all rows again', async ({ page }) => {
    const rows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row):not(.no-data-row)'
    );
    await expect(rows.first()).toBeVisible();
    const initialCount = await rows.count();

    await page.locator('.qa_filter_search input').fill('test20');
    await expect.poll(async () => rows.count()).toBeLessThan(initialCount);

    const resetSearchButton = page.locator(
      '.qa_filter_search .qa_reset_search_input'
    );
    await expect(resetSearchButton).toBeVisible();
    await resetSearchButton.click();
    await expect(rows).toHaveCount(initialCount);
  });

  test('navigates to create task page when create button is clicked', async ({
    page,
  }) => {
    await page.locator('.qa_create_task_button').click();
    await expect(page).toHaveURL(/\/task-flow\/tasks\/create$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Create Task' })
    ).toBeVisible();
  });
});
