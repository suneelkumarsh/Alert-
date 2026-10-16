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

test.describe('Create task page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/task-flow/tasks/create');

    await expect(
      page.getByRole('heading', { level: 1, name: 'Create Task' })
    ).toBeVisible({ timeout: 15000 });
  });

  test('renders the breadcrumb trail', async ({ page }) => {
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    await expect(breadcrumb.getByRole('link', { name: 'Tasks' })).toBeVisible();
    await expect(breadcrumb).toContainText('Create Task');
  });

  test('navigates back to the task list via breadcrumb', async ({ page }) => {
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Tasks' })
      .click();

    await expect(page).toHaveURL(/\/task-flow\/tasks$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tasks' })
    ).toBeVisible();
  });

  test('renders the Available Task Types panel', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Available Task Types' })
    ).toBeVisible();
    await expect(
      page.getByRole('radiogroup', { name: 'Available Task Types' })
    ).toBeVisible();
  });

  test('shows Configuration task type option', async ({ page }) => {
    await expect(
      page.getByRole('radio', { name: /^Configuration\s/ })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Use Configuration' })
    ).toBeVisible();
  });

  test('shows Consistency Check task type option', async ({ page }) => {
    await expect(
      page.getByRole('radio', { name: /^Consistency Check/ })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Use Consistency Check' })
    ).toBeVisible();
  });

  test('locks deltaCheck when taskType switches to a discrepancy task', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Use Configuration' }).click();

    const taskName = `e2e-discrepancy-lock-${Date.now()}`;
    await page.locator('#name').fill(taskName);
    await page.locator('#description').fill('created by e2e test');

    const vendorSelect = page
      .locator('tnap-select.qa_task_form_field_vendorName')
      .locator('.select-field');
    await expect(vendorSelect).toBeVisible();
    await vendorSelect.selectOption({ label: 'Huawei' });
    await expect(vendorSelect.locator('option:checked')).toHaveText('Huawei');

    const createButton = page.getByRole('button', { name: /create/i });
    await expect(createButton).toBeVisible();
    await expect(createButton).toBeEnabled();
    await createButton.click();

    const taskTypeHost = page.locator(
      'tnap-select.qa_task_form_property_taskType'
    );
    const taskTypeSelect = taskTypeHost.locator('.select-field');

    const deltaCheckRow = page
      .locator('.task-form-row')
      .filter({ has: page.locator('#property-deltaCheck-label') });
    const deltaCheckHost = deltaCheckRow.locator('.boolean-segmented-control');
    // Segmented-control buttons use `tab-<value>` as id (`tab-true`, `tab-false`, `tab-`).
    const deltaCheckYes = deltaCheckHost.locator('#tab-true');
    const deltaCheckClear = deltaCheckHost.locator('#tab-');

    await expect(taskTypeHost).toBeVisible();
    await expect(deltaCheckHost).toBeVisible();
    await expect(taskTypeSelect).toBeVisible();
    await expect(deltaCheckHost).toHaveAttribute('aria-disabled', 'true');
    await expect(deltaCheckYes).toHaveClass(/active/);

    await taskTypeSelect.selectOption({ label: 'configuration' });
    await expect(deltaCheckHost).not.toHaveAttribute('aria-disabled', 'true');
    await expect(deltaCheckClear).toHaveClass(/active/);

    await taskTypeSelect.selectOption({ label: 'discrepancy_default' });
    await expect(deltaCheckHost).toHaveAttribute('aria-disabled', 'true');
    await expect(deltaCheckYes).toHaveClass(/active/);
  });
});
