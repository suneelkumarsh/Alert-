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

const TABLE_STORAGE_KEYS = ['cm-actions-table', 'cm-actions-table-basic'];
// The column settings dropdown is rendered into the body, outside the table.
const COLUMN_SETTINGS_MENU = '.tnap-table-columns-dropdown-menu';

test.describe('CM Action column selection', { tag: '@mvpOperator' }, () => {
  test.use({ locale: 'en' });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(keys => {
      keys.forEach(key => window.localStorage.removeItem(key));
    }, TABLE_STORAGE_KEYS);
    await page.goto('/cm-action/list');
    await expect(page.locator('tnap-data-table')).toBeVisible();
  });

  test('column chooser offers a checkbox for every configurable field', async ({
    page,
  }) => {
    await page.locator('.qa_alarm_auto_settings_btn').click();

    const menu = page.locator(COLUMN_SETTINGS_MENU);
    await expect(menu.locator('#vendorName')).toBeVisible();
    await expect(menu.locator('#nfType')).toBeVisible();
    await expect(menu.locator('#execMode')).toBeVisible();
  });

  test('enabling a hidden column shows it with its header filter', async ({
    page,
  }) => {
    await expect(page.locator('.qa_cm_filter_vendorName')).toHaveCount(0);

    await page.locator('.qa_alarm_auto_settings_btn').click();
    const menu = page.locator(COLUMN_SETTINGS_MENU);
    await menu.locator('#vendorName').check();
    await menu.getByRole('button', { name: 'Save' }).click();

    await expect(
      page.getByRole('columnheader', { name: 'Vendor' })
    ).toBeVisible();
    await expect(page.locator('.qa_cm_filter_vendorName')).toBeVisible();
  });

  test('filtering a newly enabled column writes its query parameter', async ({
    page,
  }) => {
    await page.locator('.qa_alarm_auto_settings_btn').click();
    const menu = page.locator(COLUMN_SETTINGS_MENU);
    await menu.locator('#vendorName').check();
    await menu.getByRole('button', { name: 'Save' }).click();

    const filter = page.locator('.qa_cm_filter_vendorName');
    await expect(filter).toBeVisible();
    await filter.getByRole('button').click();
    await filter.locator('.qa_text-filter').fill('Huawei');

    await expect(page).toHaveURL(/vendorName=Huawei/);
  });

  test('column chooser lists the columns alphabetically', async ({ page }) => {
    await page.locator('.qa_alarm_auto_settings_btn').click();
    const menu = page.locator(COLUMN_SETTINGS_MENU);
    await expect(menu).toBeVisible();

    const labels = (
      await menu.locator('.form-check-label').allTextContents()
    ).map(label => label.trim());

    expect(labels.length).toBeGreaterThan(1);
    expect(labels).toEqual([...labels].sort((a, b) => a.localeCompare(b)));
  });

  test('column chooser stays inside the viewport', async ({ page }) => {
    await page.locator('.qa_alarm_auto_settings_btn').click();

    const menu = page.locator(COLUMN_SETTINGS_MENU);
    await expect(menu).toBeVisible();
    await expect(menu).toBeInViewport({ ratio: 1 });
  });

  test('column chooser stays inside a narrow viewport', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 480 });
    await page.locator('.qa_alarm_auto_settings_btn').click();

    const menu = page.locator(COLUMN_SETTINGS_MENU);
    await expect(menu).toBeVisible();
    await expect(menu).toBeInViewport({ ratio: 1 });
  });
});
