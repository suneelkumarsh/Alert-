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
import type { Locator, Page } from '@playwright/test';

const ROW_SELECTOR = '.qa_ran_filter_table table tbody tr:not(.loading-row)';

/** S3 object key of filter 1, mirrored by the downloadRanFilterExport stub. */
const FILTER_1_EXPORT_FILE = 'filter_1_20260101110000.zip';

/**
 * Opens the three-dots menu of a row and returns the menu, which is rendered in
 * `body` and therefore cannot be looked up inside the row.
 */
async function openRowActionsMenu(row: Locator): Promise<Locator> {
  const trigger = row.getByRole('button', { name: 'More actions' });
  await expect(trigger).toBeVisible();
  await trigger.click();

  const menu = row.page().getByRole('menu');
  await expect(menu).toBeVisible();
  return menu;
}

/** Locates a table row by its filter-name cell, independent of the current sort order. */
function rowByFilterName(page: Page, filterName: string): Locator {
  return page
    .locator(ROW_SELECTOR)
    .filter({
      has: page.getByRole('cell', { name: filterName, exact: true }),
    })
    .first();
}

/**
 * Hovers a trigger and asserts its tooltip. The tooltip is matched by text
 * because NgbTooltip keeps the previously shown window mounted while it fades
 * out, so a plain `getByRole('tooltip')` would resolve to two elements.
 */
async function expectTooltip(trigger: Locator, text: string): Promise<void> {
  await trigger.hover();
  await expect(
    trigger.page().getByRole('tooltip', { name: text, exact: true })
  ).toBeVisible();
}

test.describe('RAN Filter list page', { tag: '@mvpOperator' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ran-filter');
    await expect(
      page.getByRole('heading', { name: 'RAN Filter' })
    ).toBeVisible();
  });

  test('shows the page header', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'RAN Filter' })
    ).toBeVisible();
  });

  test('renders the filter table with expected column headers', async ({
    page,
  }) => {
    const table = page.locator('.qa_ran_filter_table');
    await expect(table).toBeVisible();

    await expect(
      page.getByRole('columnheader', { name: 'Filter ID' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Filter Name' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Filter Description' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Vendor' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Owner' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Created At' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Updated' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Export Status' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Export Timestamp' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Actions' })
    ).toBeVisible();

    // S3 Key is opt-in via the column selector.
    await expect(
      page.getByRole('columnheader', { name: 'S3 Key' })
    ).toHaveCount(0);

    const headers = page.locator('.qa_ran_filter_table table thead th');
    await expect(headers.last()).toContainText('Actions');
  });

  test('renders the export status and export timestamp', async ({ page }) => {
    const firstRow = rowByFilterName(page, 'Filter Name 1');
    await expect(firstRow).toBeVisible();

    await expect(firstRow.locator('.qa_export_status')).toHaveText('Completed');
    await expect(firstRow.locator('.qa_export_path')).toHaveCount(0);
    // Stub value 2026-01-01T11:00:00.000Z rendered as 'dd.MM.yyyy HH:mm' in Europe/Bratislava.
    await expect(firstRow.locator('.qa_export_modified_time')).toHaveText(
      '01.01.2026 12:00'
    );
  });

  test('renders a dash for filters without export data', async ({ page }) => {
    // Filter 4 is stubbed without any export fields.
    const rowWithoutExport = rowByFilterName(page, 'Filter Name 4');
    await expect(rowWithoutExport).toBeVisible();
    await expect(rowWithoutExport.locator('.qa_export_status')).toHaveText('-');
    await expect(
      rowWithoutExport.locator('.qa_export_modified_time')
    ).toHaveText('-');
  });

  test('renders an export status without a timestamp', async ({ page }) => {
    // Filter 5 is stubbed with exportStatus only.
    const partialRow = rowByFilterName(page, 'Filter Name 5');
    await expect(partialRow).toBeVisible();
    await expect(partialRow.locator('.qa_export_status')).toHaveText('Pending');
    await expect(partialRow.locator('.qa_export_modified_time')).toHaveText(
      '-'
    );
  });

  test('renders RAN filter rows from the API', async ({ page }) => {
    const rows = page.locator(
      '.qa_ran_filter_table table tbody tr:not(.loading-row)'
    );
    await expect(rows.first()).toBeVisible();
    await expect(rows).toHaveCount(50);

    await expect(
      page.getByRole('cell', { name: 'Filter Name 1', exact: true })
    ).toBeVisible();
    await expect(page.getByRole('cell', { name: 'qa.user01' })).toBeVisible();
  });

  test('renders action buttons in each row', async ({ page }) => {
    const firstRow = page.locator(ROW_SELECTOR).first();
    await expect(firstRow).toBeVisible();

    await expect(firstRow.locator('.qa_filter_action_edit')).toBeVisible();
    await expect(firstRow.locator('.qa_filter_action_execute')).toBeVisible();
    await expect(firstRow.locator('.qa_filter_action_upload')).toBeVisible();
    await expect(firstRow.locator('.qa_filter_action_more')).toBeVisible();
  });

  test('explains every icon-only action via tooltip and aria-label', async ({
    page,
  }) => {
    const firstRow = rowByFilterName(page, 'Filter Name 1');
    await expect(firstRow).toBeVisible();

    await expect(firstRow.locator('.qa_filter_action_edit')).toHaveAttribute(
      'aria-label',
      'Edit filter Filter Name 1'
    );
    await expect(firstRow.locator('.qa_filter_action_execute')).toHaveAttribute(
      'aria-label',
      'Preview result of filter Filter Name 1 (not stored in S3)'
    );
    await expect(firstRow.locator('.qa_filter_action_upload')).toHaveAttribute(
      'aria-label',
      'Execute filter Filter Name 1 and upload result to S3'
    );

    await expectTooltip(
      firstRow.locator('.qa_filter_action_execute'),
      'Preview filter result (not stored in S3)'
    );
    await expectTooltip(
      firstRow.locator('.qa_filter_action_upload'),
      'Execute filter and upload result to S3'
    );
    await expectTooltip(
      firstRow.locator('.qa_filter_action_more'),
      'More actions'
    );
  });

  test('names the more-actions entries after the action they perform', async ({
    page,
  }) => {
    const firstRow = page.locator(ROW_SELECTOR).first();
    await expect(firstRow).toBeVisible();

    const menu = await openRowActionsMenu(firstRow);

    await expect(
      menu.getByRole('menuitem', {
        name: 'Download filter result from S3',
        exact: true,
      })
    ).toBeVisible();
    await expect(
      menu.getByRole('menuitem', { name: 'Delete filter', exact: true })
    ).toBeVisible();
  });

  test('offers download and delete inside the more-actions menu', async ({
    page,
  }) => {
    const firstRow = page.locator(ROW_SELECTOR).first();
    await expect(firstRow).toBeVisible();

    const menu = await openRowActionsMenu(firstRow);

    await expect(menu.locator('.qa_filter_action_download')).toBeVisible();
    await expect(menu.locator('.qa_filter_action_delete')).toBeVisible();
  });

  test('disables the upload button while the export is pending', async ({
    page,
  }) => {
    // Filter 2 is stubbed with exportStatus "in_progress".
    const secondRow = rowByFilterName(page, 'Filter Name 2');
    await expect(secondRow).toBeVisible();

    await expect(secondRow.locator('.qa_filter_action_upload')).toBeDisabled();

    // The disabled button fires no mouse events, so the reason sits on the wrapper.
    await expectTooltip(
      secondRow.locator('.qa_filter_action_upload').locator('..'),
      'Execution and upload to S3 are already running'
    );
  });

  test('warns when the export failed instead of downloading', async ({
    page,
  }) => {
    // Filter 3 is stubbed with exportStatus "error".
    const thirdRow = rowByFilterName(page, 'Filter Name 3');
    await expect(thirdRow).toBeVisible();

    const menu = await openRowActionsMenu(thirdRow);
    const download = menu.locator('.qa_filter_action_download');
    await expect(download).toBeVisible();
    await download.click();

    await expect(page.locator('.alert-warning')).toContainText(
      'The upload failed. Download is not available.'
    );
  });

  test('warns when no upload exists instead of downloading', async ({
    page,
  }) => {
    // Filter 4 is stubbed without any export fields.
    const fourthRow = rowByFilterName(page, 'Filter Name 4');
    await expect(fourthRow).toBeVisible();

    const menu = await openRowActionsMenu(fourthRow);
    const download = menu.locator('.qa_filter_action_download');
    await expect(download).toBeVisible();
    await download.click();

    await expect(page.locator('.alert-warning')).toContainText(
      'No upload found. Download is not available.'
    );
  });

  test('downloads the exported filter result from S3', async ({ page }) => {
    const firstRow = rowByFilterName(page, 'Filter Name 1');
    await expect(firstRow).toBeVisible();

    const menu = await openRowActionsMenu(firstRow);

    const downloadPromise = page.waitForEvent('download');
    await menu.locator('.qa_filter_action_download').click();

    await expect(page.locator('.alert-info')).toContainText(
      'This may take a few minutes'
    );

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(FILTER_1_EXPORT_FILE);

    await expect(page.locator('.alert-success')).toContainText(
      'has been downloaded successfully'
    );
  });

  test('shows a progress bar in the row while the download runs', async ({
    page,
  }) => {
    let releaseDownload: () => void = () => undefined;
    const downloadHeld = new Promise<void>(resolve => {
      releaseDownload = resolve;
    });

    // Holding the response keeps the in-flight state observable instead of racing the transfer.
    await page.route('**/api/s3/buckets/filter/download**', async route => {
      await downloadHeld;
      await route.fulfill({
        status: 200,
        contentType: 'application/octet-stream',
        body: '{"filterId":1,"nodes":[]}',
      });
    });

    const firstRow = rowByFilterName(page, 'Filter Name 1');
    await expect(firstRow).toBeVisible();

    const menu = await openRowActionsMenu(firstRow);
    const downloadPromise = page.waitForEvent('download');
    await menu.locator('.qa_filter_action_download').click();

    const progress = firstRow.getByRole('progressbar');
    await expect(progress).toBeVisible();
    await expect(progress).toHaveAttribute(
      'aria-label',
      'Download progress for Filter Name 1'
    );

    // The held response keeps the total unknown, so the indeterminate status text applies.
    await expect(firstRow.getByRole('status')).toHaveText(
      'Download of Filter Name 1 started.'
    );

    releaseDownload();
    await downloadPromise;

    // The status survives the transfer for the kit's grace period, so the final percentage
    // has to stay available instead of falling back to the start message.
    await expect(firstRow.getByRole('status')).toHaveText(
      'Download of Filter Name 1: 100% complete.'
    );

    await expect(progress).toHaveCount(0);
  });

  test('exports the filter to CSV and reports only the start', async ({
    page,
  }) => {
    const firstRow = rowByFilterName(page, 'Filter Name 1');
    await expect(firstRow).toBeVisible();

    await firstRow.locator('.qa_filter_action_upload').click();

    await expect(page.locator('.alert-info')).toContainText(
      'upload to S3 has started'
    );
    // The stub answers with status "completed"; the list refresh re-enables the
    // button. Only after that is the absence of a success alert meaningful.
    await expect(firstRow.locator('.qa_filter_action_upload')).toBeEnabled();
    await expect(page.locator('.alert-success')).toHaveCount(0);
  });

  test('sorts by filter id via column sort control', async ({ page }) => {
    const firstIdCell = page
      .locator('.qa_ran_filter_table table tbody tr:not(.loading-row)')
      .first()
      .locator('td')
      .first();
    await expect(firstIdCell).toBeVisible();

    const filterIdHeader = page.getByRole('columnheader', {
      name: 'Filter ID',
    });
    const sortButton = filterIdHeader.locator('button').first();
    await expect(sortButton).toBeVisible();

    // 1st click: ASC, 2nd click: DESC
    await sortButton.click();
    await sortButton.click();

    await expect(firstIdCell).toHaveText('50');
  });

  test('filters table rows via search input', async ({ page }) => {
    const rows = page.locator(
      '.qa_ran_filter_table table tbody tr:not(.loading-row)'
    );
    await expect(rows.first()).toBeVisible();
    await expect(rows).toHaveCount(50);

    const searchInput = page.getByLabel('Search RAN-Filter');
    await searchInput.fill('Filter Name 10');

    await expect(rows).toHaveCount(1);
    await expect(
      page.getByRole('cell', { name: 'Filter Name 10', exact: true })
    ).toBeVisible();
  });

  test('resets search and shows all rows again', async ({ page }) => {
    const rows = page.locator(
      '.qa_ran_filter_table table tbody tr:not(.loading-row)'
    );
    await expect(rows.first()).toBeVisible();

    const searchInput = page.getByLabel('Search RAN-Filter');
    await searchInput.fill('Filter Name 10');
    await expect(rows).toHaveCount(1);

    const clearButton = page.getByRole('button', { name: 'Clear' });
    await clearButton.click();

    await expect(rows).toHaveCount(50);
  });

  test.describe('delete filter', () => {
    test('shows confirmation modal when delete button is clicked', async ({
      page,
    }) => {
      const firstRow = page.locator(ROW_SELECTOR).first();
      await expect(firstRow).toBeVisible();

      const menu = await openRowActionsMenu(firstRow);
      await menu.locator('.qa_filter_action_delete').click();

      const modal = page.locator('.qa_modal_header');
      await expect(modal).toBeVisible();
      await expect(page.locator('.qa_modal_title')).toContainText(
        'Delete Filter'
      );
    });

    test('closes modal without deleting when cancel is clicked', async ({
      page,
    }) => {
      const rows = page.locator(ROW_SELECTOR);
      await expect(rows.first()).toBeVisible();

      const menu = await openRowActionsMenu(rows.first());
      await menu.locator('.qa_filter_action_delete').click();

      await expect(page.locator('.qa_modal_header')).toBeVisible();
      await page.locator('.qa_cancel_button').click();

      await expect(page.locator('.qa_modal_header')).toBeHidden();
      await expect(rows).toHaveCount(50);
    });

    test('deletes filter and refreshes list when confirmed', async ({
      page,
    }) => {
      const firstRow = page.locator(ROW_SELECTOR).first();
      await expect(firstRow).toBeVisible();

      const menu = await openRowActionsMenu(firstRow);
      await menu.locator('.qa_filter_action_delete').click();

      await expect(page.locator('.qa_modal_header')).toBeVisible();
      await page.locator('.qa_apply_button').click();

      await expect(page.locator('.qa_modal_header')).toBeHidden();
    });
  });

  test.describe('execute filter', () => {
    test('renders execute action button in each row', async ({ page }) => {
      const firstRow = page
        .locator('.qa_ran_filter_table table tbody tr:not(.loading-row)')
        .first();
      await expect(firstRow).toBeVisible();

      await expect(firstRow.locator('.qa_filter_action_execute')).toBeVisible();
    });

    test('opens execute result modal when execute is clicked', async ({
      page,
    }) => {
      const firstRow = page
        .locator('.qa_ran_filter_table table tbody tr:not(.loading-row)')
        .first();
      await expect(firstRow).toBeVisible();

      await firstRow.locator('.qa_filter_action_execute').click();

      await expect(page.locator('.qa_execute_result_panel')).toBeVisible();
      await expect(page.locator('.qa_execute_result_title')).toContainText(
        'Execution Result'
      );
    });

    test('shows filter name in execute result modal subtitle', async ({
      page,
    }) => {
      const firstRow = page
        .locator('.qa_ran_filter_table table tbody tr:not(.loading-row)')
        .first();
      await expect(firstRow).toBeVisible();

      await firstRow.locator('.qa_filter_action_execute').click();

      await expect(page.locator('.qa_execute_result_subtitle')).toContainText(
        'Filter Name'
      );
    });

    test('closes execute result modal when close button is clicked', async ({
      page,
    }) => {
      const firstRow = page
        .locator('.qa_ran_filter_table table tbody tr:not(.loading-row)')
        .first();
      await expect(firstRow).toBeVisible();

      await firstRow.locator('.qa_filter_action_execute').click();

      await expect(page.locator('.qa_execute_result_panel')).toBeVisible();
      await page.locator('.qa_execute_result_close').click();

      await expect(page.locator('.qa_execute_result_modal')).toBeHidden();
    });
  });
});
