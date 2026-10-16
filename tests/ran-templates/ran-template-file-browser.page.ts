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

/** The node name a row renders is the last segment of its path. */
const nameOf = (nodePath: string): string =>
  nodePath.slice(nodePath.lastIndexOf('/') + 1);

export class RanTemplateFileBrowserPage {
  constructor(private readonly page: Page) {}

  readonly tree: Locator = this.page.getByRole('list', {
    name: 'Template directory structure',
  });
  readonly refreshButton: Locator = this.page.getByRole('button', {
    name: 'Refresh directory tree',
  });
  readonly openGitlabLink: Locator = this.page.getByRole('link', {
    name: 'Open in GitLab',
  });
  // tnap-select renders <label [for]="selectId">{{ label() }}</label>, so the <select> has a
  // real accessible name from the component's [label] input.
  readonly branchSelect: Locator = this.page.getByLabel('Branch');
  // The search box here is the local app-input-search component, not tnap-ui-kit's
  // tnap-input-search — its own accessible name is a hardcoded sr-only "Search" label,
  // unrelated to the [placeholder] input. getByPlaceholder still matches the placeholder
  // attribute directly, independent of that label.
  readonly searchInput: Locator = this.page.getByPlaceholder(
    'Search folders or templates'
  );
  readonly newFolderInput: Locator =
    this.page.getByPlaceholder('New folder name');
  readonly newFolderRow: Locator = this.page.locator('li.qa_new_folder_row');

  async goto(): Promise<void> {
    await this.page.goto('/ran-template/file-browser');
  }

  /**
   * One rendered tree row, addressed by its node **path**. The fixtures repeat every name
   * below the root — activation, termination and the three .jinja files exist under both
   * Ericsson_2024_Q1 and Ericsson_2024_Q3 — so a name-based lookup needs `.first()` and
   * then silently resolves against whichever folder happens to render first. The row's
   * `data-testid` carries the path, which is unique, so every locator derived from here
   * stays under Playwright's strict mode.
   */
  row(nodePath: string): Locator {
    return this.page.getByTestId(`tree-row-${nodePath}`);
  }

  // Scoped by class rather than role+name: the node button's aria-label is the bare node
  // name, but the row's action buttons (add folder/add file/delete) have aria-labels that
  // contain the node name as a substring too, so a role lookup for the name inside the row
  // would match all of them.
  nodeButton(nodePath: string): Locator {
    return this.row(nodePath).locator('button.qa_tree_item_button');
  }

  /** `tnapButton`'s `label` input becomes the button's aria-label. */
  addFolderButton(nodePath: string): Locator {
    return this.row(nodePath).getByRole('button', {
      name: `Add folder inside ${nameOf(nodePath)}`,
    });
  }

  addFileButton(nodePath: string): Locator {
    return this.row(nodePath).getByRole('button', {
      name: `Add file inside ${nameOf(nodePath)}`,
    });
  }

  deleteFileButton(nodePath: string): Locator {
    return this.row(nodePath).getByRole('button', {
      name: `Delete file ${nameOf(nodePath)}`,
    });
  }

  badge(nodePath: string): Locator {
    return this.row(nodePath).locator('tnap-badge');
  }

  saveFolderButton(): Locator {
    return this.newFolderRow.getByRole('button', { name: 'Save' });
  }

  cancelFolderButton(): Locator {
    return this.newFolderRow.getByRole('button', { name: 'Cancel' });
  }
}
