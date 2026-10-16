/*
 * Copyright (c) 2025. Deutsche Telekom AG
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

import { Page } from '@playwright/test';

export class DataTableTester {
  constructor(private readonly page: Page) {}

  get dataTable() {
    return this.page.locator('table#ng-data-table');
  }
  get headers() {
    return this.dataTable.locator('thead tr th');
  }
  /**
   * `.loading-row` is excluded because both data-table libraries render a skeleton `<tr>`
   * inside the real `<tbody>` while loading. A bare `tbody tr` therefore matches that
   * placeholder, and clicking it opens nothing — the failure then looks like a broken
   * feature rather than a table that had not finished loading.
   */
  get rows() {
    return this.dataTable.locator('tbody tr:not(.loading-row)');
  }
  /**
   * The empty state is a `<tr class="no-data-row">` inside the real `<tbody>`, so an empty
   * table still has one row. Use this when a spec asserts how many records are shown —
   * `expect(rows).toHaveCount(0)` can never pass, and `toHaveCount(1)` passes on an empty
   * table too.
   */
  get dataRows() {
    return this.dataTable.locator(
      'tbody tr:not(.loading-row):not(.no-data-row)'
    );
  }
  get noDataRow() {
    return this.dataTable.locator('tbody tr.no-data-row');
  }
  getHeaderByIndex(index: number) {
    return this.headers.nth(index);
  }
  getRowByIndex(index: number) {
    return this.rows.nth(index);
  }
}
