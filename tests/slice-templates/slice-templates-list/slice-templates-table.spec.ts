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
import { SliceTemplatesListPage } from './slice-templates-list.page';

test.describe('Slice Templates List Table', () => {
  test('Gitlab main branch link is visible', async ({ page }) => {
    const sliceTemplatesListPage = new SliceTemplatesListPage(page);
    await sliceTemplatesListPage.goto();

    const mainBranchLink = page.getByRole('link', {
      name: /View Slice Template in GitLab in a new tab/i,
    });
    await expect(mainBranchLink).toBeVisible();
    await mainBranchLink.focus();
    await expect(mainBranchLink).toBeFocused();

    // // External link behavior (announced by NVDA)
    await expect(mainBranchLink).toHaveAttribute('target', '_blank');
    await expect(mainBranchLink).toHaveAttribute('rel', /noopener/i);
    await expect(mainBranchLink).toHaveAttribute('href', 'http://hello.world');
  });

  test('Slice Templates Table is visible', async ({ page }) => {
    const sliceTemplatesListPage = new SliceTemplatesListPage(page);
    await sliceTemplatesListPage.goto();
    await expect(
      sliceTemplatesListPage.sliceTemplatesTable.dataTable
    ).toBeVisible();
    await expect(sliceTemplatesListPage.sliceTemplatesTable.rows).toHaveCount(
      5
    );
  });

  test('Slice Templates Table structure is as expected', async ({ page }) => {
    const sliceTemplatesListPage = new SliceTemplatesListPage(page);
    await sliceTemplatesListPage.goto();

    await expect(
      sliceTemplatesListPage.sliceTemplatesTable.dataTable
    ).toBeVisible();
    const headers = sliceTemplatesListPage.sliceTemplatesTable.headers;
    await expect(headers.nth(0)).toContainText('File Name');
    await expect(headers.nth(1)).toContainText('Status');
    await expect(headers.nth(2)).toContainText('Version');
    await expect(headers.nth(3)).toContainText('Specification ID');
    await expect(headers.nth(4)).toContainText('Actions');

    const rows = sliceTemplatesListPage.sliceTemplatesTable.rows;
    const firstRowColumns = rows.nth(0).locator('td');
    await expect(firstRowColumns.nth(0)).toContainText(
      ' slice-pi23-0-priority'
    );
    await expect(firstRowColumns.nth(2)).toContainText('3.0');
    await expect(
      firstRowColumns.nth(4).locator('.qa_edit_button')
    ).toBeVisible();
    await expect(
      firstRowColumns.nth(4).locator('.qa_delete_button')
    ).toBeVisible();

    const secondRowColumns = rows.nth(1).locator('td');
    await expect(secondRowColumns.nth(0)).toContainText('slice-0-priority');
    await expect(secondRowColumns.nth(2)).toContainText('6.0');
    await expect(
      secondRowColumns.nth(4).locator('.qa_edit_button')
    ).toBeVisible();
    await expect(
      secondRowColumns.nth(4).locator('.qa_delete_button')
    ).toBeVisible();
  });

  test('should show status column values', async ({ page }) => {
    const sliceTemplatesListPage = new SliceTemplatesListPage(page);

    await sliceTemplatesListPage.goto();

    const rows = sliceTemplatesListPage.sliceTemplatesTable.rows;

    const firstRowStatus = rows.nth(0).locator('.slice-list-status_badge');

    await expect(firstRowStatus).toBeVisible();

    const secondRowStatus = rows.nth(1).locator('.slice-list-status_badge');

    await expect(secondRowStatus).toBeVisible();
  });

  test('should show status badge in status column', async ({ page }) => {
    const sliceTemplatesListPage = new SliceTemplatesListPage(page);

    await sliceTemplatesListPage.goto();

    const statusBadge = sliceTemplatesListPage.sliceTemplatesTable.rows
      .nth(0)
      .locator('.slice-list-status_badge');

    await expect(statusBadge).toBeVisible();
    await expect(statusBadge).toContainText('Active');
  });

  test('should show all expected status badges', async ({ page }) => {
    const sliceTemplatesListPage = new SliceTemplatesListPage(page);

    await sliceTemplatesListPage.goto();

    const rows = sliceTemplatesListPage.sliceTemplatesTable.rows;

    await expect(rows.nth(0).locator('.slice-list-status_badge')).toContainText(
      'Active'
    );

    await expect(rows.nth(3).locator('.slice-list-status_badge')).toContainText(
      'Not Active'
    );

    await expect(rows.nth(4).locator('.slice-list-status_badge')).toContainText(
      'Creation in progress'
    );
  });
});
