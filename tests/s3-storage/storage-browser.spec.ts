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
import { DataTableTester } from '../../setup/data-table';
import type { Locator, Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const TAB = {
  planning: 'Planning',
  payload: 'Configuration',
  network: 'Network',
  filter: 'Filter',
  day0: 'Day0',
} as const;

/** getS3BucketsObjectCounts.json */
const BUCKET_BADGE_COUNT = {
  [TAB.planning]: '808',
  [TAB.payload]: '106',
  [TAB.network]: '1000',
  [TAB.filter]: '17',
} as const;

const PLANNING = {
  key: 'do4/planning-data/adapters/atoll/2026-08-26T04.55.49/job-1787719827417/original/TNAP_EXPORT_LTE_CELL.csv.gz',
  fileName: 'TNAP_EXPORT_LTE_CELL.csv.gz',
  size: '2.44 MB',
  acl: 'private',
  // Rendered with environment.dateTimeFormat.long (dd.MM.yyyy HH:mm) in local time
  lastModifiedAt: /^\s*\d{2}\.\d{2}\.2026 \d{2}:\d{2}\s*$/,
};

const PLANNING_KEY_DESC_FIRST_KEY =
  'do4/planning-data/pif/2026-08-27T11.16.31/transmission-vlans.csv';

const FILTER_FIRST_KEY =
  'do4/filter-data/filter_411/20260731122242/filter_411_20260731122242.zip';
const FILTER_TOTAL_COUNT = 17;

const FILTER_SEARCH_TERM = 'do3';
const FILTER_SEARCH_COUNT = 5;
const FILTER_SEARCH_FIRST_KEY =
  'do3/filter-data/filter_3/20260814095809/filter_3_20260814095809.zip';

const KEY_COLUMN_HEADER = 'Key';
const NO_FILES_MESSAGE = 'No files found';
const DOWNLOAD_FAILED_MESSAGE = 'Failed to download file. Please try again.';
const SEARCH_LABEL = 'Search files';

const table = (page: Page): DataTableTester => new DataTableTester(page);

const bucketTab = (page: Page, label: string): Locator =>
  page.getByRole('button', { name: `Select bucket ${label}` });

const searchInput = (page: Page): Locator =>
  page.getByRole('textbox', { name: SEARCH_LABEL });

const downloadButton = (page: Page, key: string): Locator =>
  page.getByRole('button', { name: `Download ${key}` });

async function openBucket(page: Page, label: string): Promise<void> {
  const tab = bucketTab(page, label);
  await tab.click();
  await expect(tab).toHaveClass(/active/);
  await expect(table(page).dataRows.first()).toBeVisible();
}

test.describe('S3 Storage Browser list page', { tag: '@mvpOperator' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/s3-storage-browser');
    await expect(page.locator('.qa_s3_storage_page')).toBeVisible();
    await expect(table(page).dataRows.first()).toBeVisible();
  });

  test('selects the first canonical bucket and names it in the title', async ({
    page,
  }) => {
    await expect(page.locator('.bucket-label')).toBeVisible();
    await expect(page.locator('.files-title')).toBeVisible();

    await expect(bucketTab(page, TAB.planning)).toHaveClass(/active/);
    await expect(page.locator('.files-title')).toContainText(TAB.planning);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('renders one tab per bucket with the counts returned by the API', async ({
    page,
  }) => {
    await expect(page.locator('.bucket-tabs .bucket-tab')).toHaveCount(5);

    for (const [label, count] of Object.entries(BUCKET_BADGE_COUNT)) {
      await expect(bucketTab(page, label).locator('.tab-badge')).toContainText(
        count
      );
    }
  });

  test('marks only the truncated bucket with the + indicator', async ({
    page,
  }) => {
    await expect(
      bucketTab(page, TAB.network).locator('.tab-badge')
    ).toContainText(`${BUCKET_BADGE_COUNT[TAB.network]}+`);
    await expect(
      bucketTab(page, TAB.planning).locator('.tab-badge')
    ).not.toContainText('+');
  });

  test('renders the stubbed objects of the default bucket', async ({
    page,
  }) => {
    const firstRow = table(page).dataRows.first();
    await expect(firstRow).toBeVisible();
    const cells = firstRow.locator('td');
    await expect(cells).toHaveCount(5);
    await expect(cells.nth(0)).toHaveText(PLANNING.key);
    await expect(cells.nth(1)).toHaveText(PLANNING.size);
    await expect(cells.nth(2)).toHaveText(PLANNING.acl);
    await expect(cells.nth(3)).toHaveText(PLANNING.lastModifiedAt);
    await expect(downloadButton(page, PLANNING.key)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('loads the objects of the bucket that was clicked', async ({ page }) => {
    await openBucket(page, TAB.filter);

    await expect(table(page).dataRows).toHaveCount(FILTER_TOTAL_COUNT);
    await expect(table(page).dataRows.first().locator('td').first()).toHaveText(
      FILTER_FIRST_KEY
    );

    await expect(page.locator('.files-title')).toContainText(TAB.filter);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('shows the empty state for a bucket without objects', async ({
    page,
  }) => {
    const emptyBucketResponse = page.waitForResponse(
      response =>
        response.url().includes('/api/s3/buckets/day0/objects') &&
        response.status() === 200
    );

    const day0Tab = bucketTab(page, TAB.day0);
    await expect(day0Tab.locator('.tab-badge')).toContainText('0');
    await day0Tab.click();
    await emptyBucketResponse;

    await expect(table(page).dataRows).toHaveCount(0);
    await expect(table(page).noDataRow).toContainText(NO_FILES_MESSAGE);
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('sends the search term as keyFilter and renders the filtered result', async ({
    page,
  }) => {
    await openBucket(page, TAB.filter);

    const filteredRequest = page.waitForRequest(
      request =>
        request.url().includes('/api/s3/buckets/filter/objects') &&
        request.url().includes(`keyFilter=${FILTER_SEARCH_TERM}`)
    );

    await searchInput(page).fill(FILTER_SEARCH_TERM);
    await filteredRequest;

    await expect(table(page).dataRows).toHaveCount(FILTER_SEARCH_COUNT);
    await expect(table(page).dataRows.first().locator('td').first()).toHaveText(
      FILTER_SEARCH_FIRST_KEY
    );
  });

  test('drops the search term when another bucket is selected', async ({
    page,
  }) => {
    await openBucket(page, TAB.filter);
    await searchInput(page).fill(FILTER_SEARCH_TERM);
    await expect(table(page).dataRows).toHaveCount(FILTER_SEARCH_COUNT);

    await openBucket(page, TAB.planning);
    await expect(table(page).dataRows.first().locator('td').first()).toHaveText(
      PLANNING.key
    );
    await expect(searchInput(page)).toHaveValue('');
  });

  test('renders the order the server returned when a column is sorted', async ({
    page,
  }) => {
    const sortedRequest = page.waitForRequest(
      request =>
        request.url().includes('/api/s3/buckets/planning/objects') &&
        request.url().includes('sortBy=key') &&
        request.url().includes('sortDirection=DESC')
    );

    const keySort = page
      .locator('.qa_s3_storage_table thead th', { hasText: KEY_COLUMN_HEADER })
      .locator('tnap-sort button');
    await keySort.click();
    await keySort.click();
    await sortedRequest;
    await expect(table(page).dataRows.first().locator('td').first()).toHaveText(
      PLANNING_KEY_DESC_FIRST_KEY
    );
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('downloads the selected object as a binary file', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');
    await downloadButton(page, PLANNING.key).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain(PLANNING.fileName);

    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const content = await readFile(downloadPath as string);
    expect(content.subarray(0, 2)).toEqual(Buffer.from([0x1f, 0x8b]));

    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('alerts when the download is rejected by the backend', async ({
    page,
  }) => {
    await openBucket(page, TAB.filter);
    await searchInput(page).fill(FILTER_SEARCH_TERM);
    await expect(table(page).dataRows).toHaveCount(FILTER_SEARCH_COUNT);
    await downloadButton(page, FILTER_SEARCH_FIRST_KEY).click();

    await expect(
      page.locator('tnap-alert ngb-alert').filter({
        hasText: DOWNLOAD_FAILED_MESSAGE,
      })
    ).toBeVisible();
  });
});
