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
import { DataTableTester } from '../../setup/data-table';

export class PolicyListPage {
  readonly policyTable = new DataTableTester(this.page);

  constructor(private readonly page: Page) {}

  async goto(filter?: string) {
    const query = filter ? `?filter=${encodeURIComponent(filter)}` : '';
    await this.page.goto(`/policy-builder/list-policy${query}`);
  }

  get searchInput() {
    return this.page.getByRole('textbox', { name: /search/i });
  }

  /** The `×` that `tnap-input-search` renders once the field holds a value. */
  get clearSearchButton() {
    return this.page.locator('.qa_reset_search_input');
  }

  get mainBranchLink() {
    return this.page.locator('.qa_link_main_branch');
  }

  get emptyMessage() {
    return this.policyTable.noDataRow.locator('tnap-empty');
  }

  get policyNames() {
    return this.policyTable.dataRows.locator('.qa_name_value');
  }

  /**
   * Rows are matched by the policy name they render, not by index: the list keeps the order
   * the backend returns, so an index-based lookup silently asserts against a different
   * policy as soon as a mapping gains an entry — which is exactly what the version/status
   * columns must not be allowed to do.
   */
  rowFor(policyName: string) {
    return this.policyTable.dataRows.filter({
      has: this.page.getByText(policyName, { exact: true }),
    });
  }

  versionCellFor(policyName: string) {
    return this.rowFor(policyName).locator('.qa_policyVersion_value');
  }

  statusCellFor(policyName: string) {
    return this.rowFor(policyName).locator('app-policy-status');
  }

  viewButtonFor(policyName: string) {
    return this.rowFor(policyName).locator('.qa_view_button');
  }

  editButtonFor(policyName: string) {
    return this.rowFor(policyName).locator('.qa_edit_button');
  }
}
