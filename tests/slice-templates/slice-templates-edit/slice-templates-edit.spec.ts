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

test.describe('Slice Templates Edit', () => {
  test.beforeEach(async ({ page }) => {
    const sliceTemplatesListPage = new SliceTemplatesListPage(page);

    // Navigate to the slice templates list page
    await sliceTemplatesListPage.goto();

    // Wait for the table to be visible
    await sliceTemplatesListPage.sliceTemplatesTable.dataTable.waitFor({
      state: 'visible',
      timeout: 10000,
    });

    // Find and click the Edit button for mojo-test-nsst-16
    const rows = sliceTemplatesListPage.sliceTemplatesTable.rows;
    const thirdRow = rows.nth(2);
    const editButton = thirdRow.locator('.qa_edit_button');
    await editButton.click();

    // Verify the edit page heading
    const heading = page.locator('h1.qa_page_title');
    await expect(heading).toContainText('Properties for Slice Template');
  });

  test('Page loads with prefilled data and enabled buttons', async ({
    page,
  }) => {
    // Template Name and Description should be prefilled
    await expect(page.getByLabel('Template Name')).toHaveValue(
      'mojo-test-nsst-16'
    );
    await expect(page.getByLabel('Description')).toHaveValue(
      'demo slice templates'
    );

    // The action button label may be "Close" or "Discard" depending on the UI version.
    // Use an exact match to avoid accidentally selecting the sidebar "Close side menu" control.
    await expect(
      page.getByRole('button', { name: /^(close|discard)$/i })
    ).toBeEnabled();
    await expect(page.getByRole('button', { name: 'Save' })).toBeEnabled();

    // There should be one row in the properties table for plmnInfoList
    const propertiesTable = page.locator('table');
    const tableRows = propertiesTable.locator('tbody tr:not(.loading-row)');
    await expect(tableRows).toHaveCount(1);

    // Check each column in the row
    const firstRow = tableRows.first();
    const cells = firstRow.locator('td');

    // assert column values
    await expect(cells.nth(0)).toHaveText(' plmnInfoList ');
    await expect(cells.nth(1)).toHaveText('tosca.datatypes.3gpp.PlmnInfo');
    await expect(cells.nth(2)).toContainText('');

    // Edit and Delete buttons in the row should be enabled
    await expect(
      firstRow.getByRole('button', { name: 'Edit property' })
    ).toBeEnabled();
    await expect(
      firstRow.getByRole('button', { name: 'Delete property' })
    ).toBeEnabled();
  });

  test('Edit property button opens edit pane', async ({ page }) => {
    // Click the Edit property button in the first row
    const propertiesTable = page.locator('table');
    const firstRow = propertiesTable
      .locator('tbody tr:not(.loading-row)')
      .first();
    await firstRow.getByRole('button', { name: 'Edit property' }).click();

    // Assert that the edit property pane opens with the correct title
    const editPaneHeading = page.getByRole('heading', {
      name: 'Edit property plmnInfoList',
    });
    await expect(editPaneHeading).toBeVisible();
  });

  test('Can fill in Template Name, Description and Service Role', async ({
    page,
  }) => {
    await page.getByLabel('Template Name').fill('new-template');
    await page.getByLabel('Description').fill('a new slice template');
    await page.getByLabel('Service Role').fill('some-role');

    await page.getByRole('button', { name: 'Save' }).click();
  });
});
