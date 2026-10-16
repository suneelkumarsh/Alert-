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

test.describe('Workflow list page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/task-flow/workflow');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Workflows' })
    ).toBeVisible();
  });

  test('renders workflow rows from the API', async ({ page }) => {
    const rows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row)'
    );
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    await expect(rows).toHaveCount(10, { timeout: 10000 });

    await expect(
      page
        .locator('.qa_workflow_name', {
          hasText: 'day0-input-test-workflow',
        })
        .first()
    ).toBeVisible();

    const workflowRow = page.locator('tbody tr', {
      has: page.locator('.qa_workflow_name', {
        hasText: 'test-input-component',
      }),
    });
    await expect(
      workflowRow.first().locator('.qa_instances_button')
    ).toBeVisible();
  });

  test('renders filter controls and action buttons', async ({ page }) => {
    await expect(page.locator('.qa_filter_search')).toBeVisible();
    await expect(page.locator('.qa_filter_status')).toBeVisible();
    await expect(page.locator('.qa_create_workflow_button')).toBeVisible();

    const firstRow = page
      .locator('.qa_configurations_table tbody tr:not(.loading-row)')
      .first();
    await expect(firstRow.locator('.qa_instances_button')).toBeVisible();
    await expect(firstRow.locator('.qa_execute_button')).toBeVisible();
    await expect(firstRow.locator('.qa_more_actions_button')).toBeVisible();
  });

  test('filters table rows via search input', async ({ page }) => {
    const rows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row)'
    );
    await expect(rows).toHaveCount(10);
    await page.locator('.qa_filter_search input').fill('day0');
    await expect(rows).toHaveCount(1);
    await expect(
      page
        .locator('.qa_workflow_name', { hasText: 'day0-input-test-workflow' })
        .first()
    ).toBeVisible();
  });

  test('navigates to create workflow page when create button is clicked', async ({
    page,
  }) => {
    await page.locator('.qa_create_workflow_button').click();

    await expect(page).toHaveURL(/\/task-flow\/workflow\/create$/);
    await expect(page.locator('#workflow-name')).toBeVisible();
  });

  test('navigates to workflow instances when instances button is clicked', async ({
    page,
  }) => {
    const workflowRow = page.locator('tbody tr', {
      has: page
        .locator('.qa_workflow_name', { hasText: 'day0-input-test-workflow' })
        .first(),
    });

    await workflowRow.first().locator('.qa_instances_button').click();

    await expect(page).toHaveURL(
      /\/task-flow\/workflow\/day0-input-test-workflow\/instances$/
    );
    await expect(
      page.locator('.qa_workflow_instances_breadcrumb')
    ).toContainText('Execution History');
  });
});
