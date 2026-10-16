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

import type { Page } from '@playwright/test';

import { test, expect } from '../../fixtures';

// The four rows getCmActionSearch.json puts first, one per cancellability case:
//   NODE-NEW-001       status: new                  (cancellable)
//   NODE-QUEUED-002    status: activation_queued    (cancellable)
//   NODE-WAITING-003   status: waiting_for_approval (cancellable)
//   NODE-COMPLETED-004 status: activation_completed (NOT cancellable)
//
// KTDES-C-86206 is the one row carrying an `aaiServiceReference`, which is what makes the slice
// cell render its link: keep it, or the a11y route scan stops covering that branch of the cell.
const ID_NEW = 'aaa00000-0000-0000-0000-000000000001';
const ID_QUEUED = 'aaa00000-0000-0000-0000-000000000002';
const ID_WAITING = 'aaa00000-0000-0000-0000-000000000003';
const DOWNLOAD_FAILED_MESSAGE = 'Failed to export CM Actions.';

// Rows are addressed by their object name, not by index: the stub repeats most status values
// (three rows are activation_completed) and the table arrives sorted by createdAt, so neither
// the status text nor a row index identifies one row.
const row = (page: Page, objectName: string) =>
  page.locator('tnap-data-table tbody tr').filter({ hasText: objectName });

// Scoped to the row, never to the page: `enableMasterCheckBox` puts a select-all checkbox in
// the header, so the first checkbox on the page is not a row's.
const rowCheckbox = (page: Page, objectName: string) =>
  row(page, objectName).locator('input[type="checkbox"]');

test.describe('CM Action Table', { tag: '@mvpOperator' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cm-action/list');
    await expect(page.locator('tnap-data-table')).toBeVisible();
  });

  test('renders the data table', async ({ page }) => {
    await expect(page.locator('tnap-data-table')).toBeVisible();
  });

  test('pagination footer is visible without scrolling the page', async ({
    page,
  }) => {
    await expect(page.locator('tnap-pagination')).toBeInViewport();
  });

  test('the content area does not scroll vertically', async ({ page }) => {
    await expect(
      page.locator('tnap-data-table tbody tr').first()
    ).toBeVisible();

    // `main.container-fluid` is the scroll container, not the document element.
    const mainScrolls = await page.evaluate(() => {
      const main = document.querySelector('main.container-fluid');
      return !!main && main.scrollHeight > main.clientHeight;
    });

    expect(mainScrolls).toBe(false);
  });

  // tnap-layout owns the scroll container, so a broken height chain surfaces there
  // rather than on `main`, and only once the viewport is too short for the table.
  test('keeps the pagination footer pinned in a short viewport', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 500 });
    await expect(
      page.locator('tnap-data-table tbody tr').first()
    ).toBeVisible();

    const layoutScrolls = await page.evaluate(() => {
      const content = document.querySelector('tnap-layout > .content-wrapper');
      return !!content && content.scrollHeight > content.clientHeight + 1;
    });

    expect(layoutScrolls).toBe(false);
    await expect(page.locator('tnap-pagination')).toBeInViewport();
  });

  test('table has rows', async ({ page }) => {
    await expect(
      page.locator('tnap-data-table tbody tr').first()
    ).toBeVisible();
  });

  test('cancel button is visible in the first row', async ({ page }) => {
    const firstRow = page.locator('tnap-data-table tbody tr').first();
    await expect(firstRow).toBeVisible();

    const cancelBtn = firstRow.locator('.qa_cancel_cm_action_btn');
    await expect(cancelBtn).toBeVisible();
  });

  test('cancel button is enabled for cancellable row (new)', async ({
    page,
  }) => {
    const cancelBtn = row(page, 'NODE-NEW-001').locator(
      '.qa_cancel_cm_action_btn'
    );

    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toBeEnabled();
  });

  test('cancel button is enabled for activation_queued row', async ({
    page,
  }) => {
    const cancelBtn = row(page, 'NODE-QUEUED-002').locator(
      '.qa_cancel_cm_action_btn'
    );

    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toBeEnabled();
  });

  test('cancel button is enabled for waiting_for_approval row', async ({
    page,
  }) => {
    const cancelBtn = row(page, 'NODE-WAITING-003').locator(
      '.qa_cancel_cm_action_btn'
    );

    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toBeEnabled();
  });

  test('cancel button is disabled for completed row', async ({ page }) => {
    const cancelBtn = row(page, 'NODE-COMPLETED-004').locator(
      '.qa_cancel_cm_action_btn'
    );

    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toBeDisabled();
  });

  // Single-row cancel modal

  test('clicking cancel opens confirmation modal', async ({ page }) => {
    const cancelBtn = page.locator('.qa_cancel_cm_action_btn').first();

    await expect(cancelBtn).toBeVisible();
    await expect(cancelBtn).toBeEnabled();

    await cancelBtn.click();
    await expect(page.locator('ngb-modal-window')).toBeVisible();
  });

  test('modal title is "Cancel CM Actions?"', async ({ page }) => {
    const cancelBtn = page.locator('.qa_cancel_cm_action_btn').first();
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();

    await expect(
      page.locator('ngb-modal-window .qa_modal_title')
    ).toContainText('Cancel CM Actions?');
  });

  test('modal body text warns the action cannot be undone', async ({
    page,
  }) => {
    const cancelButton = page.locator('.qa_cancel_cm_action_btn').first();
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    const modal = page.locator('ngb-modal-window');
    await expect(modal).toBeVisible();
    await expect(modal).toContainText('cannot be undone');
  });

  test('modal has apply and cancel buttons', async ({ page }) => {
    const row = page
      .locator('tnap-data-table tbody tr')
      .filter({ has: page.locator('.qa_cancel_cm_action_btn') })
      .first();

    const cancelButton = row.locator('.qa_cancel_cm_action_btn');
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    const modal = page.locator('ngb-modal-window');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.qa_apply_button')).toBeVisible();
    await expect(modal.locator('.qa_cancel_button')).toBeVisible();
  });

  test('apply button label is "Yes, Cancel"', async ({ page }) => {
    const cancelButton = page.locator('.qa_cancel_cm_action_btn').first();
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    const applyButton = page.locator('ngb-modal-window .qa_apply_button');
    await expect(applyButton).toBeVisible();
    await expect(applyButton).toContainText('Yes, Cancel');
  });

  test('cancel button label is "Back"', async ({ page }) => {
    const cancelButton = page.locator('.qa_cancel_cm_action_btn').first();

    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    const backButton = page.locator('ngb-modal-window .qa_cancel_button');
    await expect(backButton).toBeVisible();
    await expect(backButton).toContainText('Back');
  });

  test('dismissing modal closes it without API call', async ({ page }) => {
    let apiCalled = false;
    page.on('request', req => {
      if (
        req.url().includes('/api/cm-action/cancel') &&
        req.method() === 'PUT'
      ) {
        apiCalled = true;
      }
    });

    const cancelButton = page.locator('.qa_cancel_cm_action_btn').first();
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    const cancelModalButton = page.locator(
      'ngb-modal-window .qa_cancel_button'
    );
    await expect(cancelModalButton).toBeVisible();
    await cancelModalButton.click();
    await expect(page.locator('ngb-modal-window')).toBeHidden();

    expect(apiCalled).toBe(false);
  });

  test('confirming cancel calls PUT /api/cm-action/cancel/bulk', async ({
    page,
  }) => {
    const cancelButton = page.locator('.qa_cancel_cm_action_btn').first();
    await expect(cancelButton).toBeVisible();

    const requestPromise = page.waitForRequest(
      req =>
        req.url().includes('/api/cm-action/cancel/bulk') &&
        req.method() === 'PUT'
    );
    await cancelButton.click();

    const applyButton = page.locator('ngb-modal-window .qa_apply_button');
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    const req = await requestPromise;
    expect(req.method()).toBe('PUT');
  });

  test('confirming cancel sends correct row ID in request body', async ({
    page,
  }) => {
    const requestPromise = page.waitForRequest(
      req =>
        req.url().includes('/api/cm-action/cancel/bulk') &&
        req.method() === 'PUT'
    );

    const cancelButton = page.locator('.qa_cancel_cm_action_btn').first();
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();
    const applyButton = page.locator('ngb-modal-window .qa_apply_button');
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    const req = await requestPromise;
    const body = req.postDataJSON() as {
      configManagementActions: string[];
    };

    expect(body.configManagementActions).toContain(ID_NEW);
    expect(body.configManagementActions).toHaveLength(1);
  });

  test('successful cancel shows success alert', async ({ page }) => {
    const cancelButton = page.locator('.qa_cancel_cm_action_btn').first();

    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    const applyButton = page.locator('ngb-modal-window .qa_apply_button');

    await expect(applyButton).toBeVisible();
    await applyButton.click();
    await expect(page.locator('tnap-alert')).toContainText(
      /cancelled successfully/i
    );
  });

  // Bulk cancel (checkboxes)

  test('bulk cancel button is visible', async ({ page }) => {
    await expect(
      page.locator('tnap-data-table tbody tr').first()
    ).toBeVisible();

    const bulkCancelButton = page.locator('.qa_cancel_all_cm_action_btn');

    await expect(bulkCancelButton).toBeVisible({
      timeout: 15000,
    });
  });

  test('bulk cancel button is disabled when no rows are checked', async ({
    page,
  }) => {
    await expect(
      page.locator('tnap-data-table tbody tr').first()
    ).toBeVisible();

    const bulkCancelButton = page.locator('.qa_cancel_all_cm_action_btn');

    await expect(bulkCancelButton).toBeVisible();
    await expect(bulkCancelButton).toBeDisabled();
  });

  test('checking a cancellable row enables the bulk cancel button', async ({
    page,
  }) => {
    await rowCheckbox(page, 'NODE-NEW-001').check();

    await expect(page.locator('.qa_cancel_all_cm_action_btn')).toBeEnabled();
  });

  test('bulk cancel button label shows selected count', async ({ page }) => {
    await rowCheckbox(page, 'NODE-NEW-001').check();
    await rowCheckbox(page, 'NODE-QUEUED-002').check();

    await expect(page.locator('.qa_cancel_all_cm_action_btn')).toContainText(
      '2'
    );
  });

  test('unchecking all rows disables the bulk cancel button', async ({
    page,
  }) => {
    const checkbox = rowCheckbox(page, 'NODE-NEW-001');
    await checkbox.check();

    const bulkCancelButton = page.locator('.qa_cancel_all_cm_action_btn');

    await expect(bulkCancelButton).toBeEnabled();
    await checkbox.uncheck();
    await expect(bulkCancelButton).toBeDisabled();
  });

  test('bulk cancel sends both IDs when two rows are checked', async ({
    page,
  }) => {
    const requestPromise = page.waitForRequest(
      req =>
        req.url().includes('/api/cm-action/cancel/bulk') &&
        req.method() === 'PUT'
    );

    await rowCheckbox(page, 'NODE-NEW-001').check();
    await rowCheckbox(page, 'NODE-QUEUED-002').check();

    const bulkCancelButton = page.locator('.qa_cancel_all_cm_action_btn');
    await expect(bulkCancelButton).toBeEnabled();
    await bulkCancelButton.click();

    const applyButton = page.locator('ngb-modal-window .qa_apply_button');
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    const req = await requestPromise;
    const body = req.postDataJSON() as {
      configManagementActions: string[];
    };

    expect(body.configManagementActions).toContain(ID_NEW);
    expect(body.configManagementActions).toContain(ID_QUEUED);
    expect(body.configManagementActions).toHaveLength(2);
  });

  test('dismissing bulk cancel modal does not call the API', async ({
    page,
  }) => {
    let apiCalled = false;

    page.on('request', req => {
      if (
        req.url().includes('/api/cm-action/cancel/bulk') &&
        req.method() === 'PUT'
      ) {
        apiCalled = true;
      }
    });

    await rowCheckbox(page, 'NODE-NEW-001').check();

    const bulkCancelButton = page.locator('.qa_cancel_all_cm_action_btn');
    await expect(bulkCancelButton).toBeEnabled();
    await bulkCancelButton.click();

    const cancelButton = page.locator('ngb-modal-window .qa_cancel_button');
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    await expect(page.locator('ngb-modal-window')).toBeHidden();
    expect(apiCalled).toBe(false);
  });

  test('successful bulk cancel shows success alert', async ({ page }) => {
    await rowCheckbox(page, 'NODE-NEW-001').check();
    await rowCheckbox(page, 'NODE-QUEUED-002').check();

    const bulkCancelButton = page.locator('.qa_cancel_all_cm_action_btn');
    await expect(bulkCancelButton).toBeEnabled();
    await bulkCancelButton.click();

    const applyButton = page.locator('ngb-modal-window .qa_apply_button');
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    await expect(
      page.locator('tnap-alert').filter({
        hasText: /cancelled successfully/i,
      })
    ).toBeVisible();
  });

  test('bulk approval button is visible and disabled when no rows are checked', async ({
    page,
  }) => {
    const bulkApproveButton = page.locator('.qa_cancel_all_cm_approve_btn');

    await expect(bulkApproveButton).toBeVisible();
    await expect(bulkApproveButton).toBeDisabled();
  });

  test('checking a waiting-for-approval row enables the bulk approval button', async ({
    page,
  }) => {
    await rowCheckbox(page, 'NODE-WAITING-003').check();

    const bulkApproveButton = page.locator('.qa_cancel_all_cm_approve_btn');
    await expect(bulkApproveButton).toBeEnabled();
    await expect(bulkApproveButton).toContainText('1');
  });

  test('bulk approval sends the selected waiting-for-approval row ID', async ({
    page,
  }) => {
    const requestPromise = page.waitForRequest(
      req =>
        req.url().includes('/api/cm-action/approval/bulk') &&
        req.method() === 'PUT'
    );

    await rowCheckbox(page, 'NODE-WAITING-003').check();

    const bulkApproveButton = page.locator('.qa_cancel_all_cm_approve_btn');
    await expect(bulkApproveButton).toBeEnabled();
    await bulkApproveButton.click();

    const applyButton = page.locator('ngb-modal-window .qa_apply_button');
    await expect(applyButton).toBeVisible();
    await applyButton.click();

    const req = await requestPromise;
    const body = req.postDataJSON() as {
      configManagementActions: string[];
    };

    expect(body.configManagementActions).toContain(ID_WAITING);
    expect(body.configManagementActions).toHaveLength(1);
  });

  // The selection spans pages, so a row left checked here would be approved a second time
  // together with the next page's selection.
  test('bulk approval unselects the rows it has approved', async ({ page }) => {
    const checkbox = rowCheckbox(page, 'NODE-WAITING-003');
    await checkbox.check();

    const bulkApproveButton = page.locator('.qa_cancel_all_cm_approve_btn');
    await bulkApproveButton.click();
    await page.locator('ngb-modal-window .qa_apply_button').click();

    await expect(checkbox).not.toBeChecked();
    await expect(bulkApproveButton).toBeDisabled();
  });

  test('dismissing the bulk approval modal keeps the rows selected', async ({
    page,
  }) => {
    const checkbox = rowCheckbox(page, 'NODE-WAITING-003');
    await checkbox.check();

    await page.locator('.qa_cancel_all_cm_approve_btn').click();
    await page.locator('ngb-modal-window .qa_cancel_button').click();

    await expect(page.locator('ngb-modal-window')).toBeHidden();
    await expect(checkbox).toBeChecked();
  });

  test('dismissing the bulk approval modal does not call the API', async ({
    page,
  }) => {
    let apiCalled = false;

    page.on('request', req => {
      if (
        req.url().includes('/api/cm-action/approval/bulk') &&
        req.method() === 'PUT'
      ) {
        apiCalled = true;
      }
    });

    await rowCheckbox(page, 'NODE-WAITING-003').check();

    const bulkApproveButton = page.locator('.qa_cancel_all_cm_approve_btn');
    await expect(bulkApproveButton).toBeEnabled();
    await bulkApproveButton.click();

    const cancelButton = page.locator('ngb-modal-window .qa_cancel_button');
    await expect(cancelButton).toBeVisible();
    await cancelButton.click();

    await expect(page.locator('ngb-modal-window')).toBeHidden();
    expect(apiCalled).toBe(false);
  });

  // Sorting
  // The library renders tnap-sort natively inside the <th class="qa_<key>_header"> element
  // for every column whose ColumnDefinition has sorting.enabled = true.

  test('sort control is rendered for a visible sortable column', async ({
    page,
  }) => {
    // status has sorting: true in the config — the library renders tnap-sort inside its header
    await expect(page.locator('.qa_status_header tnap-sort')).toBeVisible();
  });

  test('sort control is not rendered for a visible non-sortable column', async ({
    page,
  }) => {
    // vendorName has no sorting flag — the library must not render a sort button
    await expect(
      page.locator('.qa_vendorName_header tnap-sort')
    ).not.toBeVisible();
  });

  test('the sorted column header exposes its direction as aria-sort', async ({
    page,
  }) => {
    const createdAtHeader = page.locator('.qa_createdAt_header');
    const statusHeader = page.locator('.qa_status_header');

    await expect(createdAtHeader).toHaveAttribute('aria-sort', 'descending');
    await expect(statusHeader).not.toHaveAttribute('aria-sort', /.*/);

    await page
      .locator('.qa_status_header tnap-sort')
      .getByRole('button')
      .click();

    await expect(statusHeader).toHaveAttribute('aria-sort', 'ascending');
    await expect(createdAtHeader).not.toHaveAttribute('aria-sort', /.*/);
  });

  test('the sort control is named after its column', async ({ page }) => {
    // The library sets aria-label = column label only; the sort state is conveyed by
    // aria-sort on the <th> (checked in the "aria-sort" test above).
    const statusSort = page
      .locator('.qa_status_header tnap-sort')
      .getByRole('button');

    await expect(statusSort).toHaveAttribute('aria-label', 'Status');

    await statusSort.click();

    // aria-label stays as the column label regardless of direction
    await expect(statusSort).toHaveAttribute('aria-label', 'Status');
  });

  test('sorting a column requests the search endpoint with sort parameters', async ({
    page,
  }) => {
    const statusHeader = page.locator('.qa_status_header');
    await expect(statusHeader).toBeVisible();

    const requestPromise = page.waitForRequest(req => {
      const url = new URL(req.url());
      return (
        url.pathname.includes('/api/cm-action/search') &&
        url.searchParams.get('sortBy') === 'status' &&
        url.searchParams.get('sortDirection') === 'ASC'
      );
    });
    await statusHeader.click();

    const request = await requestPromise;
    const params = new URL(request.url()).searchParams;
    expect(params.get('sortBy')).toBe('status');
    expect(params.get('sortDirection')).toBe('ASC');
  });

  test('clicking the same column twice sorts descending', async ({ page }) => {
    const statusHeader = page.locator('.qa_status_header');
    const statusSort = statusHeader.locator('tnap-sort').getByRole('button');
    await expect(statusSort).toBeVisible();

    await statusHeader.click();
    // After first click the header is ascending
    await expect(statusHeader).toHaveAttribute('aria-sort', 'ascending');

    const requestPromise = page.waitForRequest(req => {
      const url = new URL(req.url());
      return (
        url.pathname.includes('/api/cm-action/search') &&
        url.searchParams.get('sortBy') === 'status' &&
        url.searchParams.get('sortDirection') === 'DESC'
      );
    });
    await statusHeader.click();

    const request = await requestPromise;
    const params = new URL(request.url()).searchParams;

    expect(params.get('sortBy')).toBe('status');
    expect(params.get('sortDirection')).toBe('DESC');
  });

  test('sorting another column resets the previous sort state', async ({
    page,
  }) => {
    const statusHeader = page.locator('.qa_status_header');
    const objectHeader = page.locator('.qa_object_header');

    await statusHeader.click();
    // Status is now ascending
    await expect(statusHeader).toHaveAttribute('aria-sort', 'ascending');

    await objectHeader.click();

    // The API sorts by a single column, so the previous header must lose aria-sort -
    // otherwise the page announces two sorted columns while only one is applied.
    await expect(statusHeader).not.toHaveAttribute('aria-sort', /.*/);
    await expect(objectHeader).toHaveAttribute('aria-sort', 'ascending');
  });

  test('export button is visible', async ({ page }) => {
    await expect(page.locator('.qa_cm_action_export_btn')).toBeVisible();
  });

  test('downloads CM actions export file', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');

    await page.locator('.qa_cm_action_export_btn').click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBeTruthy();

    const downloadPath = await download.path();

    expect(downloadPath).toBeTruthy();
  });

  test('alerts when export download is rejected by the backend', async ({
    page,
  }) => {
    await page.route('**/api/cm-action/download**', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Export failed',
          detail: 'Failed to export CM Actions.',
        }),
      });
    });

    await page.locator('.qa_cm_action_export_btn').click();

    await expect(
      page.locator('tnap-alert ngb-alert').filter({
        hasText: DOWNLOAD_FAILED_MESSAGE,
      })
    ).toBeVisible();
  });
});
