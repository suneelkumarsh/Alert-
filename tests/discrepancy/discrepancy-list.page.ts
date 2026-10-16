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

import type { Locator, Page } from '@playwright/test';
import { DataTableTester } from '../../setup/data-table';

/** The endpoint the whole page hangs off; `page.route` patterns share it. */
export const DISCREPANCY_ENDPOINT = '**/api/cm-action/discrepancy';

export class DiscrepancyListPage {
  readonly table = new DataTableTester(this.page);

  /** `collectionSize` — the full total, not the number of rows rendered. */
  readonly totalCount: Locator = this.page.locator('.paginationCount .count');
  /** Renders `<current> of <totalPages>`. */
  readonly paginationStatus: Locator = this.page.locator(
    '.app-table-pagination-status'
  );
  readonly nextPage: Locator = this.page.getByRole('link', { name: /next/i });
  /*
   * Deliberately not named `pageSizeSelect`: `playwright/prefer-locator` reads a receiver
   * whose property starts with `page` as the Page object and warns on every locator call
   * made through it.
   */
  readonly itemsPerPageSelect: Locator = this.page.locator('#ng-item-select');
  /** The skeleton placeholder the table shows while a request is in flight. */
  readonly loadingRows: Locator = this.table.dataTable.locator(
    'tbody tr.loading-row'
  );

  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto('/discrepancy/discrepancy-list');
  }

  /**
   * Addressed by discrepancy id rather than by index: the list arrives in whatever order
   * the backend sends and the spec asserts values *inside* the row, so an index lookup
   * would start asserting against a different record as soon as the fixture grows.
   */
  row(id: string): Locator {
    return this.table.dataRows.filter({
      has: this.page.locator('.qa_id_value', { hasText: id }),
    });
  }

  /** A single cell of a row, by the column key `DiscrepancyListComponent` declares. */
  cell(id: string, columnKey: string): Locator {
    return this.row(id).locator(`.qa_${columnKey}_value`);
  }
}
