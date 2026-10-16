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

const WORKFLOW_NAME = 'day0-input-test-workflow';
const REQUEST_ID = 'req-aaa-111';
const DETAILS_URL = `/task-flow/workflow/${WORKFLOW_NAME}/instances/${REQUEST_ID}`;

test.describe('Workflow instance details page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(DETAILS_URL);
    await expect(
      page.locator('.qa_workflow_instance_details_breadcrumb')
    ).toBeVisible();
    await expect(
      page.locator('.qa_workflow_instance_details_breadcrumb')
    ).toContainText('Execution');
  });

  test('renders page title and breadcrumb', async ({ page }) => {
    await expect(
      page.locator('.qa_workflow_instance_details_breadcrumb')
    ).toContainText('Execution');
    await expect(
      page
        .locator('.qa_workflow_instance_details_breadcrumb')
        .getByRole('link', { name: WORKFLOW_NAME })
    ).toBeVisible();
  });

  test('renders task rows from the API', async ({ page }) => {
    const rows = page.locator(
      '.qa_workflow_instance_details_table tbody tr:not(.loading-row)'
    );
    await expect(rows.first()).toBeVisible();
    await expect(rows).toHaveCount(2);

    await expect(
      page.locator('.qa_artifact_link', { hasText: 'day0-output-file.yaml' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: /ran-task-1/ })
    ).toBeVisible();
  });

  test('links ran tasks with pgwTaskId to cm action list', async ({ page }) => {
    const ranTaskActionButton = page.getByRole('button', {
      name: /ran-task-1/,
    });

    await expect(ranTaskActionButton).toBeVisible();
    await ranTaskActionButton.click();
    await expect(page).toHaveURL(/\/cm-action\/list\?taskId=pgw-ran-task-1$/);
  });

  test('renders filter controls', async ({ page }) => {
    await expect(page.locator('.qa_filter_status')).toBeVisible();
    await expect(page.locator('.qa_filter_search')).toBeVisible();
  });

  test('filters rows via search input', async ({ page }) => {
    const rows = page.locator(
      '.qa_workflow_instance_details_table tbody tr:not(.loading-row)'
    );
    await expect(rows).toHaveCount(2);

    await page.locator('.qa_filter_search input').fill('day0');
    await expect(rows).toHaveCount(1);
    await expect(
      page.locator('.qa_artifact_link', { hasText: 'day0-output-file.yaml' })
    ).toBeVisible();
  });

  test('shows artifact link for successful tasks', async ({ page }) => {
    await expect(
      page.locator('.qa_artifact_link', { hasText: 'day0-output-file.yaml' })
    ).toBeVisible();
  });

  test('keeps config artifact links visible when a mixed xml artifact/error payload is returned', async ({
    page,
  }) => {
    await page.goto(
      '/task-flow/workflow/day0-input-test-workflow/instances/req-config-111'
    );

    const rows = page.locator(
      '.qa_workflow_instance_details_table tbody tr:not(.loading-row)'
    );
    await expect(rows).toHaveCount(1);
    await expect(
      page.locator('.qa_artifact_link', { hasText: 'config.xml' })
    ).toBeVisible();
    await expect(
      page.locator('.qa_workflow_instance_details_table')
    ).toContainText('PGW-900-202: Activation marked blocked by the policy');
  });

  test('breadcrumb navigates to the instances list', async ({ page }) => {
    await page
      .locator('.qa_workflow_instance_details_breadcrumb')
      .getByRole('link', { name: WORKFLOW_NAME })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/task-flow/workflow/${WORKFLOW_NAME}/instances$`)
    );
    await expect(
      page.locator('.qa_workflow_instances_breadcrumb')
    ).toContainText('Execution History');
  });
});
