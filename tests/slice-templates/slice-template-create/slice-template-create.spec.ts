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

import { expect, test } from '../../../fixtures';
import { SliceTemplatesListPage } from '../slice-templates-list/slice-templates-list.page';

test.describe('Slice Templates Create', () => {
  test.beforeEach(async ({ page }) => {
    const sliceTemplatesListPage = new SliceTemplatesListPage(page);

    // Navigate to the slice templates list page
    await sliceTemplatesListPage.goto();

    // Wait for the table to be visible
    await sliceTemplatesListPage.sliceTemplatesTable.dataTable.waitFor({
      state: 'visible',
      timeout: 10000,
    });

    // Click on "Add Slice Template"
    await sliceTemplatesListPage.addSliceTemplateButton.click();

    // Verify the edit page heading
    const heading = page.locator('h1.qa_page_title');
    await expect(heading).toContainText('Properties for Slice Template');
    await expect(page.getByLabel('Template Name')).toHaveValue('');
    await expect(page.getByLabel('Description')).toHaveValue('');

    // The action button label may be "Close" or "Discard" depending on the UI version.
    // Use an exact match to avoid accidentally selecting the sidebar "Close side menu" control.
    await expect(
      page.getByRole('button', { name: /^(close|discard)$/i })
    ).toBeEnabled();
    // Save buttons should be disabled (not enabled)
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();

    // There should be zero row in the properties table
    const propertiesTable = page.locator('table');
    const tableRows = propertiesTable.locator('tbody tr:not(.loading-row)');
    await expect(tableRows).toHaveCount(0);
  });

  test('Once all mandatory fields are filled, should enable the Save button', async ({
    page,
  }) => {
    await page.getByLabel('Template Name').fill('new-template');
    await page.getByLabel('Description').fill('a new slice template');
    await page.getByLabel('Service Role').fill('some-role');
    await page.getByLabel('Service Type').fill('some-type');

    // Now Save should be enabled
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();
  });

  test('Can fill form and trigger POST API on Save', async ({ page }) => {
    await page.getByLabel('Template Name').fill('new-template');
    await page.getByLabel('Description').fill('a new slice template');
    await page.getByLabel('Service Role').fill('some-role');
    await page.getByLabel('Service Type').fill('some-type');
    // --- CLICK SAVE ---
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(
      page.getByText(
        'Template is saved and deployment started. Processing will take 2 - 10 minutes.'
      )
    ).toBeVisible({
      timeout: 10000,
    });
  });
});
