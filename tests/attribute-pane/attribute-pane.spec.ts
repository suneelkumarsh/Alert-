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

import { test, expect, type Page } from '../../fixtures';

/*
 * `tnap-data-table` renders a skeleton `<tr class="loading-row">` inside a real `tbody`
 * while the slice request is in flight, so a bare `tbody tr` matches it — clicking that
 * placeholder opens nothing and the detail pane never appears. Scoping the locator away
 * from it makes the click wait for an actual data row instead.
 */
async function openFirstSliceDetail(page: Page) {
  await page.goto('/slice-management/slice-list');
  await page.locator('tbody tr:not(.loading-row)').first().click();
  await expect(page.locator('text=Slice Details')).toBeVisible();
}

test('Tooltip accessibility for checkbox', async ({ page }) => {
  await openFirstSliceDetail(page);

  const checkbox = page.locator('.qa_attribute_pane_switch');
  await expect(checkbox).toBeVisible();
  await expect(checkbox).toHaveAttribute(
    'aria-label',
    'show only filled attributes'
  );
  await checkbox.hover();
  await expect(page.locator('[role="tooltip"]')).toBeVisible();
});

test('Tooltip text should be present as attribute', async ({ page }) => {
  await openFirstSliceDetail(page);

  const switchEl = page.locator('.qa_attribute_pane_switch');

  const tooltipId = await switchEl.getAttribute('aria-describedby');
  await expect(page.locator(`#${tooltipId}`)).toContainText(
    'By setting the option'
  );
});

test('Tooltip should appear on hover', async ({ page }) => {
  await openFirstSliceDetail(page);

  const checkbox = page.locator('.qa_attribute_pane_switch');
  await checkbox.hover();

  const tooltip = page.locator('[role="tooltip"]');
  await expect(tooltip).toBeVisible();
});

test('Tooltip should appear on focus', async ({ page }) => {
  await openFirstSliceDetail(page);

  const checkbox = page.locator('.qa_attribute_pane_switch');
  await checkbox.focus();

  const tooltip = page.locator('[role="tooltip"]');
  await expect(tooltip).toBeVisible();
});

test('Tooltip should have meaningful text', async ({ page }) => {
  await openFirstSliceDetail(page);

  const checkbox = page.locator('.qa_attribute_pane_switch');
  await checkbox.hover();

  const tooltip = page.locator('[role="tooltip"]');
  await expect(tooltip).toContainText('By setting the option');
});

test('Checkbox should be linked to tooltip (aria-describedby)', async ({
  page,
}) => {
  await openFirstSliceDetail(page);
  const checkbox = page.locator('.qa_attribute_pane_switch');
  await expect(checkbox).toBeVisible({
    timeout: 15000,
  });
  const attr = await checkbox.getAttribute('aria-describedby');
  expect(attr).not.toBeNull();
});
