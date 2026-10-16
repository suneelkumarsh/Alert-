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

// The only open-loop, waiting-for-approval row in getCmActionSearch.json, and the id
// getCmActionWaitingForApproval.json serves to the detail pane's own request. Any other row leaves
// the pane without its Approve/Reject buttons.
const ID_WAITING = 'aaa00000-0000-0000-0000-000000000003';
const NODE = 'NODE-WAITING-003';
const DOWNLOAD_FAILED_MESSAGE = 'Failed to download S3 file links.';

// Rows are addressed by their object name, like in cm-action-table.spec.ts: the fixture repeats
// most status values and arrives sorted by createdDate, so no index identifies this row.
const row = (page: Page, objectName: string) =>
  page.locator('tnap-data-table tbody tr').filter({ hasText: objectName });

const detailPane = (page: Page) => page.locator('app-cm-action-detail');

// Both the pane and the confirmation modal label their button with the same okBtn translation.
const modalButton = (page: Page, name: string) =>
  page.locator('ngb-modal-window').getByRole('button', { name });

/**
 * The bulk endpoint answers 200 with a per-id message whether it acted or refused, and each test
 * here needs a different message for the same id, so the response is stubbed per test rather than
 * added to the shared treeview mapping. Returns the request bodies it saw.
 */
const stubDecision = async (page: Page, message: string) => {
  const requests: {
    configManagementActions: string[];
    approval?: boolean;
  }[] = [];

  await page.route('**/api/cm-action/approval/bulk', async route => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ [ID_WAITING]: message }),
    });
  });

  return requests;
};

test.describe('CM Action detail pane', { tag: '@mvpOperator' }, () => {
  // The pane is opened from the row, not by deep link: the table's constructor clears the `id`
  // query param as soon as the filter streams emit, so `?id=…` never survives the first render.
  test.beforeEach(async ({ page }) => {
    await page.goto('/cm-action/list');
    await row(page, NODE).getByRole('button', { name: 'Show details' }).click();
    await expect(detailPane(page)).toBeVisible();
  });

  test('approving sends the single action to the bulk endpoint and closes the pane', async ({
    page,
  }) => {
    const requests = await stubDecision(page, 'Approval completed');

    await detailPane(page).getByRole('button', { name: 'Approve' }).click();
    await modalButton(page, 'Approve').click();

    await expect(
      page.locator('tnap-alert ngb-alert').filter({
        hasText: `CM action for ${NODE} approved.`,
      })
    ).toBeVisible();
    await expect(detailPane(page)).toHaveCount(0);

    expect(requests).toEqual([
      { configManagementActions: [ID_WAITING], approval: true },
    ]);
  });

  // The reject direction is the reason the flag exists: the endpoint denies only on approval=false,
  // and an omitted flag would approve.
  test('rejecting sends the same action with approval false', async ({
    page,
  }) => {
    const requests = await stubDecision(page, 'Approval denied');

    await detailPane(page).getByRole('button', { name: 'Reject' }).click();
    await modalButton(page, 'Reject').click();

    await expect(
      page.locator('tnap-alert ngb-alert').filter({
        hasText: `CM action for ${NODE} rejected.`,
      })
    ).toBeVisible();

    expect(requests).toEqual([
      { configManagementActions: [ID_WAITING], approval: false },
    ]);
  });

  test('a refused approval is reported and keeps the pane open', async ({
    page,
  }) => {
    await stubDecision(
      page,
      'ConfigManagementAction is not awaiting approval (status=ACTIVATION_SEND_FAILED)'
    );

    await detailPane(page).getByRole('button', { name: 'Approve' }).click();
    await modalButton(page, 'Approve').click();

    await expect(
      page.locator('tnap-alert ngb-alert').filter({
        hasText: `CM action for ${NODE} could not be approved`,
      })
    ).toBeVisible();
    await expect(detailPane(page)).toBeVisible();
  });

  test('dismissing the confirmation does not decide the action', async ({
    page,
  }) => {
    const requests = await stubDecision(page, 'Approval completed');

    await detailPane(page).getByRole('button', { name: 'Approve' }).click();
    await page.locator('ngb-modal-window .qa_cancel_button').click();

    await expect(page.locator('ngb-modal-window')).toHaveCount(0);
    await expect(detailPane(page)).toBeVisible();
    expect(requests).toEqual([]);
  });
});

test.describe('CM Action S3 downloads', { tag: '@mvpOperator' }, () => {
  test('shows SBI payload and activation result links for completed action', async ({
    page,
  }) => {
    await page.goto('/cm-action/list');

    await row(page, 'NODE-COMPLETED-004')
      .getByRole('button', { name: 'Show details' })
      .click();

    await expect(detailPane(page)).toBeVisible();

    await detailPane(page).getByText('More').click();

    await detailPane(page).getByText('Other').click();

    await expect(
      detailPane(page).locator('.qa_sbi_payload_download')
    ).toBeVisible();

    await expect(
      detailPane(page).locator('.qa_activationResult_download')
    ).toBeVisible();
  });

  test('downloads SBI payload file for completed action', async ({ page }) => {
    await page.goto('/cm-action/list');

    await row(page, 'NODE-COMPLETED-004')
      .getByRole('button', { name: 'Show details' })
      .click();

    await expect(detailPane(page)).toBeVisible();

    await detailPane(page).getByText('More').click();

    await detailPane(page).getByText('Other').click();

    const downloadPromise = page.waitForEvent('download');

    await detailPane(page).locator('.qa_sbi_payload_download').click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBeTruthy();

    const downloadPath = await download.path();

    expect(downloadPath).toBeTruthy();
  });

  test('downloads activation result file for completed action', async ({
    page,
  }) => {
    await page.goto('/cm-action/list');

    await row(page, 'NODE-COMPLETED-004')
      .getByRole('button', { name: 'Show details' })
      .click();

    await expect(detailPane(page)).toBeVisible();

    await detailPane(page).getByText('More').click();

    await detailPane(page).getByText('Other').click();

    const downloadPromise = page.waitForEvent('download');

    await detailPane(page).locator('.qa_activationResult_download').click();

    const download = await downloadPromise;

    expect(download.suggestedFilename()).toBeTruthy();

    const downloadPath = await download.path();

    expect(downloadPath).toBeTruthy();
  });

  test('alerts when SBI payload download is rejected by the backend', async ({
    page,
  }) => {
    await page.goto('/cm-action/list');

    await row(page, 'NODE-COMPLETED-005')
      .getByRole('button', { name: 'Show details' })
      .click();

    await expect(detailPane(page)).toBeVisible();

    await detailPane(page).getByText('More').click();

    await detailPane(page).getByText('Other').click();

    await detailPane(page).locator('.qa_sbi_payload_download').click();

    await expect(
      page.locator('tnap-alert ngb-alert').filter({
        hasText: DOWNLOAD_FAILED_MESSAGE,
      })
    ).toBeVisible();
  });

  test('alerts when activation result download is rejected by the backend', async ({
    page,
  }) => {
    await page.goto('/cm-action/list');

    await row(page, 'NODE-COMPLETED-005')
      .getByRole('button', { name: 'Show details' })
      .click();

    await expect(detailPane(page)).toBeVisible();

    await detailPane(page).getByText('More').click();

    await detailPane(page).getByText('Other').click();

    await detailPane(page).locator('.qa_activationResult_download').click();

    await expect(
      page.locator('tnap-alert ngb-alert').filter({
        hasText: DOWNLOAD_FAILED_MESSAGE,
      })
    ).toBeVisible();
  });
});
