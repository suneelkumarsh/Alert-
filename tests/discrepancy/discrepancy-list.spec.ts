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
import {
  DISCREPANCY_ENDPOINT,
  DiscrepancyListPage,
} from './discrepancy-list.page';

// Both numbers come from getCmActionDiscrepancies.json and from
// discrepancy/configuration.ts respectively. 12 against 10 is what gives the list a
// second page holding exactly 2 rows.
const SEEDED_DISCREPANCIES = 12;
const DEFAULT_PAGE_SIZE = 10;

// The nine columns DiscrepancyListComponent declares, in declaration order, as the
// English labels of `discrepancy.fields.*`.
const COLUMN_LABELS = [
  'ID',
  'Filter',
  'Node',
  'Cell',
  'Attribute',
  'Expected Value',
  'Actual Value',
  'Priority',
  'CM Action',
];

test.describe('Discrepancy list', () => {
  test('renders the seeded discrepancies one page at a time', async ({
    page,
  }) => {
    const discrepancies = new DiscrepancyListPage(page);
    await discrepancies.goto();

    await expect(discrepancies.table.dataTable).toBeVisible();

    // The page slices client-side: it renders one page but reports the full total.
    await expect(discrepancies.table.dataRows).toHaveCount(DEFAULT_PAGE_SIZE);
    await expect(discrepancies.totalCount).toHaveText(
      String(SEEDED_DISCREPANCIES)
    );
    // `withLoading()` swallows a failed request into an empty list, so an empty table is
    // also what a broken backend looks like — assert the empty state is absent, not just
    // that the table rendered.
    await expect(discrepancies.table.noDataRow).toHaveCount(0);
  });

  test('shows every column of the discrepancy record', async ({ page }) => {
    const discrepancies = new DiscrepancyListPage(page);
    await discrepancies.goto();

    await expect(discrepancies.table.headers).toHaveText(COLUMN_LABELS);
  });

  test('maps each field of a discrepancy onto its own column', async ({
    page,
  }) => {
    const discrepancies = new DiscrepancyListPage(page);
    await discrepancies.goto();

    await expect(discrepancies.row('DISC-0001')).toHaveCount(1);

    // Every value in the fixture is unique across rows, so a column reading its
    // neighbour's field — the failure mode this table's nine `value` callbacks invite —
    // shows up here rather than passing on a coincidence.
    await expect(discrepancies.cell('DISC-0001', 'filter')).toHaveText(
      'filter_berlin_north'
    );
    await expect(discrepancies.cell('DISC-0001', 'node')).toHaveText('BY0008');
    await expect(discrepancies.cell('DISC-0001', 'cell')).toHaveText('7909001');
    await expect(discrepancies.cell('DISC-0001', 'attribute')).toContainText(
      'NRCellCU=7909001/attributes/arfcnDL'
    );
    await expect(discrepancies.cell('DISC-0001', 'expectedValue')).toHaveText(
      '8'
    );
    await expect(discrepancies.cell('DISC-0001', 'actualValue')).toHaveText(
      '10'
    );
    await expect(discrepancies.cell('DISC-0001', 'priority')).toHaveText('1');
    await expect(discrepancies.cell('DISC-0001', 'cmAction')).toHaveText(
      'cma-0001'
    );
  });

  test('leaves the CM Action cell empty for a discrepancy without one', async ({
    page,
  }) => {
    const discrepancies = new DiscrepancyListPage(page);
    await discrepancies.goto();

    // `cmAction` is the one optional field in the schema. The column renders `row.cmAction`
    // straight through, so a missing value must come out blank rather than as the string
    // "undefined".
    await expect(discrepancies.cell('DISC-0007', 'cmAction')).toHaveText('');
    await expect(discrepancies.cell('DISC-0007', 'node')).toHaveText('CO0301');
  });

  test('pages through to the remainder of the list', async ({ page }) => {
    const discrepancies = new DiscrepancyListPage(page);
    await discrepancies.goto();

    await expect(discrepancies.paginationStatus).toContainText('1 of 2');
    await expect(discrepancies.row('DISC-0001')).toHaveCount(1);
    await expect(discrepancies.row('DISC-0012')).toHaveCount(0);

    await discrepancies.nextPage.click();

    await expect(discrepancies.paginationStatus).toContainText('2 of 2');
    // 12 records over a page size of 10 leaves exactly 2 on the last page.
    await expect(discrepancies.table.dataRows).toHaveCount(
      SEEDED_DISCREPANCIES - DEFAULT_PAGE_SIZE
    );
    await expect(discrepancies.row('DISC-0012')).toHaveCount(1);
    await expect(discrepancies.row('DISC-0001')).toHaveCount(0);
    // The total is a property of the list, not of the page being viewed.
    await expect(discrepancies.totalCount).toHaveText(
      String(SEEDED_DISCREPANCIES)
    );
  });

  test('re-slices the list when the page size changes', async ({ page }) => {
    const discrepancies = new DiscrepancyListPage(page);
    await discrepancies.goto();

    await expect(discrepancies.table.dataRows).toHaveCount(DEFAULT_PAGE_SIZE);

    // Options are labelled, not valued: `[ngValue]` on a number makes the DOM value an
    // index, so selecting by value would silently pick the wrong entry.
    await discrepancies.itemsPerPageSelect.selectOption({
      label: '20 items per page',
    });

    await expect(discrepancies.table.dataRows).toHaveCount(
      SEEDED_DISCREPANCIES
    );
    await expect(discrepancies.paginationStatus).toContainText('1 of 1');
    await expect(discrepancies.row('DISC-0012')).toHaveCount(1);
  });

  test('shows the empty state when there are no discrepancies', async ({
    page,
  }) => {
    await page.route(DISCREPANCY_ENDPOINT, async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    const discrepancies = new DiscrepancyListPage(page);
    await discrepancies.goto();

    await expect(discrepancies.table.noDataRow).toHaveCount(1);
    await expect(discrepancies.table.dataRows).toHaveCount(0);
    // The table drops the pagination chrome entirely when there are no records, so an
    // empty list has no total to read — asserting it is absent is the only way to pin
    // this, and it is what stops the "0 discrepancies" case regressing into a stray
    // "Total Count:" with nothing after it.
    await expect(discrepancies.totalCount).toHaveCount(0);
  });

  test('falls back to an empty table when the request fails', async ({
    page,
  }) => {
    await page.route(DISCREPANCY_ENDPOINT, async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'discrepancy lookup unavailable' }),
      });
    });

    const discrepancies = new DiscrepancyListPage(page);
    await discrepancies.goto();

    /*
     * Pinning the *current* behaviour, which is not the desirable one: `withLoading()`
     * maps the error to `{ items: [], totalCount: 0 }`, so a 500 is presented as "no
     * discrepancies" with nothing distinguishing it from a genuinely empty list. What this
     * test guards is the half that is still worth guarding — the page recovers instead of
     * hanging on the loading skeleton — and it will need updating when the page grows a
     * real error state.
     */
    await expect(discrepancies.table.noDataRow).toHaveCount(1);
    await expect(discrepancies.loadingRows).toHaveCount(0);
  });
});
