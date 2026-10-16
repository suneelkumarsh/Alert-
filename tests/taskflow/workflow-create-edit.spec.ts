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

test.describe('Create workflow page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/task-flow/workflow/create');
    await expect(page.locator('.qa_workflow_create_page')).toBeVisible();
    await expect(page.locator('#workflow-name')).toBeVisible();
  });

  test('renders property editor', async ({ page }) => {
    await expect(page.locator('#workflow-name')).toBeVisible();
    await expect(page.locator('#workflow-description')).toBeVisible();
    await expect(page.locator('.qa_apply_workflow_button')).toBeVisible();
  });

  test('creates a new workflow and enters canvas mode', async ({ page }) => {
    await page.locator('#workflow-name').fill('testing-for-e2e');
    // Description is required too. This used to be omitted and still pass, because the
    // name's async validator left the form PENDING — and the button was disabled on
    // `invalid`, which a PENDING form is not. With that hole closed the button stays
    // disabled until the form is genuinely complete, so both fields must be filled.
    await page.locator('#workflow-description').fill('created by an e2e test');
    // Waits for the debounced async name validation to settle rather than clicking into
    // the PENDING window and relying on Playwright's retry to outlast it.
    await expect(page.locator('.qa_apply_workflow_button')).toBeEnabled();
    await page.locator('.qa_apply_workflow_button').click();

    // POST /services returns b0e3edf0; app switches to edit mode showing the canvas
    await expect(page.locator('.qa_certify_button')).toBeVisible();
    await expect(page.locator('.qa_discard_button')).toBeVisible();
  });

  test('navigates back to workflow list via breadcrumb', async ({ page }) => {
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Workflows' })
      .click();

    await expect(page).toHaveURL(/\/task-flow\/workflow$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Workflows' })
    ).toBeVisible();
  });
});

test.describe('Edit workflow page', () => {
  test.beforeEach(async ({ page }) => {
    // test-input-component (61957b99) is CERTIFIED in the stub
    await page.goto(
      '/task-flow/workflow/edit/61957b99-693a-49f4-b2c9-439c56ce7012'
    );
    await expect(page).toHaveURL(/\/task-flow\/workflow\/edit\//);
    await expect(page.locator('.qa_workflow_create_page')).toBeVisible();
    await expect(page.locator('.qa_checkout_button')).toBeVisible();
  });

  test('renders checkout button and discard button', async ({ page }) => {
    await expect(page.locator('.qa_checkout_button')).toBeVisible();
    await expect(page.locator('.qa_discard_button')).toBeVisible();
  });

  test('navigates back to workflow list via breadcrumb', async ({ page }) => {
    await page
      .getByRole('navigation', { name: 'Breadcrumb' })
      .getByRole('link', { name: 'Workflows' })
      .click();

    await expect(page).toHaveURL(/\/task-flow\/workflow$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Workflows' })
    ).toBeVisible();
  });

  test('checkout replaces checkout button with certify button', async ({
    page,
  }) => {
    await page.locator('.qa_checkout_button').click();

    // checkout stub returns NOT_CERTIFIED_CHECKOUT
    await expect(page).toHaveURL(/\/task-flow\/workflow\/edit\//);
    await expect(page.locator('.qa_workflow_create_page')).toBeVisible();
    await expect(page.locator('.qa_certify_button')).toBeVisible();
    await expect(page.locator('.qa_checkout_button')).not.toBeVisible();
  });

  test('certify and distribute enables execute', async ({ page }) => {
    await page.locator('.qa_checkout_button').click();
    await expect(page).toHaveURL(/\/task-flow\/workflow\/edit\//);
    await expect(page.locator('.qa_certify_button')).toBeVisible();

    const paletteAddButton = page
      .locator('.qa_palette_add_direct_button:not([disabled])')
      .first();
    await expect(paletteAddButton).toBeVisible();
    await paletteAddButton.click();
    await expect(page.locator('.qa_certify_button')).toBeVisible();
    await page.locator('.qa_certify_button').click();

    // CertifyDistribute stub returns CERTIFIED + DISTRIBUTED
    await expect(page.locator('.qa_checkout_button')).toBeVisible();
    await expect(page.locator('.qa_execute_workflow_button')).toBeEnabled();
    await page.locator('.qa_execute_workflow_button').click();
    await expect(
      page.getByText('Workflow executed successfully.')
    ).toBeVisible();
  });

  test('Execute Direct shows success notification', async ({ page }) => {
    await page.locator('.qa_checkout_button').click();
    const paletteAddButton = page
      .locator('.qa_palette_add_direct_button:not([disabled])')
      .first();
    await paletteAddButton.click();
    await page.locator('.qa_certify_button').click();

    // Wait for certify/distribute completion before attempting execute.
    await expect(page.locator('.qa_execute_workflow_button')).toBeEnabled();

    // Current UI exposes a single execute button; it triggers the direct
    // execution flow when clicked.
    await page.locator('.qa_execute_workflow_button').click();

    await expect(
      page.getByText('Workflow executed successfully.')
    ).toBeVisible();
  });

  test('Execute Distributed shows success notification', async ({ page }) => {
    await page.locator('.qa_checkout_button').click();
    await page
      .locator('.qa_palette_add_direct_button:not([disabled])')
      .first()
      .click();

    await page.locator('.qa_certify_button').click();

    // Wait for certify/distribute completion before attempting execute.
    await expect(page.locator('.qa_execute_workflow_button')).toBeEnabled();

    // Current UI exposes a single execute button; it handles the distributed
    // execution flow internally when needed.
    await page.locator('.qa_execute_workflow_button').click();

    await expect(
      page.getByText('Workflow executed successfully.')
    ).toBeVisible();
  });
});
