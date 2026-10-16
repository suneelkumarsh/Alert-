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
const INSTANCES_URL = `/task-flow/workflow/${WORKFLOW_NAME}/instances`;

test.describe('Workflow instances page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(INSTANCES_URL);
    await expect(
      page.locator('.qa_workflow_instances_breadcrumb')
    ).toBeVisible();
    await expect(
      page.locator('.qa_workflow_instances_breadcrumb')
    ).toContainText('Execution History');
  });

  test('renders page title and breadcrumb', async ({ page }) => {
    await expect(
      page.locator('.qa_workflow_instances_breadcrumb')
    ).toContainText('Execution History');
    await expect(
      page
        .locator('.qa_workflow_instances_breadcrumb')
        .getByRole('link', { name: 'Workflows' })
    ).toBeVisible();
  });

  test('renders instance rows from the API', async ({ page }) => {
    const rows = page.locator(
      '.qa_workflow_instances_table tbody tr:not(.loading-row)'
    );
    await expect(rows.first()).toBeVisible();
    await expect(rows).toHaveCount(3);

    await expect(
      rows.first().getByRole('button', { name: /req-aaa-111/ })
    ).toBeVisible();
  });

  test('renders filter controls', async ({ page }) => {
    await expect(page.locator('.qa_filter_status')).toBeVisible();
    await expect(page.locator('.qa_filter_search')).toBeVisible();
  });

  test('filters rows via search input', async ({ page }) => {
    const rows = page.locator(
      '.qa_workflow_instances_table tbody tr:not(.loading-row)'
    );
    await expect(rows).toHaveCount(3);

    await page.locator('.qa_filter_search input').fill('req-bbb');
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText('req-bbb-222');
  });

  test('navigates to instance details when request ID is clicked', async ({
    page,
  }) => {
    const rows = page.locator(
      '.qa_workflow_instances_table tbody tr:not(.loading-row)'
    );
    const requestRow = page.locator('tbody tr', {
      has: page.getByRole('cell', { name: 'req-aaa-111', exact: true }),
    });
    const detailsButton = requestRow.getByRole('button', {
      name: /req-aaa-111/,
    });

    await expect(rows.first()).toBeVisible();
    await expect(detailsButton).toBeVisible();
    await detailsButton.click();
    await expect(page).toHaveURL(
      new RegExp(
        `/task-flow/workflow/${WORKFLOW_NAME}/instances/req-aaa-111(?:\\?.*)?$`
      )
    );
    await expect(
      page.locator('.qa_workflow_instance_details_breadcrumb')
    ).toContainText('Execution');
  });

  test('breadcrumb navigates to workflow list', async ({ page }) => {
    await page
      .locator('.qa_workflow_instances_breadcrumb')
      .getByRole('link', { name: 'Workflows' })
      .click();
    await expect(page).toHaveURL(/\/task-flow\/workflow$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Workflows' })
    ).toBeVisible();
  });
});
