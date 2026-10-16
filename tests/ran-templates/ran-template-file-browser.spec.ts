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
import { RanTemplateFileBrowserPage } from './ran-template-file-browser.page';

// Rows are addressed by node path, so the vendor folders are named once here.
const Q1 = 'Ericsson_2024_Q1';
const Q3 = 'Ericsson_2024_Q3';

// The draft covering the whole Ericsson_2024_Q1/activation folder — see getRanTemplateDrafts.json.
const ACTIVATION_DRAFT_LABEL =
  '19cc078f-bd76-49e7-a980-79dfd05233b9_Ericsson_2024_Q1_activation';
// Scoped to cell_config.jinja so isSelectedDraftNode/getDraftBranchName's exact-path match
// re-enables and badges that one file — see getRanTemplateDrafts.json.
const CELL_CONFIG_DRAFT_LABEL = `${ACTIVATION_DRAFT_LABEL}_cell_config`;

test.describe('RAN template file browser', () => {
  test('renders the repository root from the default branch', async ({
    page,
  }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    await expect(browser.tree).toBeVisible();
    await expect(browser.row(Q1)).toBeVisible();
    await expect(browser.row(Q3)).toBeVisible();
    await expect(browser.row('README.md')).toBeVisible();

    // A file on the default branch is published; the badge label is the branch word "main".
    await expect(browser.badge('README.md')).toHaveText('main');
    // Folders carry no badge and no delete action.
    await expect(browser.badge(Q1)).toHaveCount(0);
    await expect(browser.deleteFileButton('README.md')).toHaveCount(0);

    // The GitLab link is the source draft's url — see getRanTemplatesSourceDraft.json — so it
    // follows the repository the environment is configured with.
    await expect(browser.openGitlabLink).toHaveAttribute(
      'href',
      'https://gitlab.devops.telekom.de/tnap/development/ran-do1-policies-templates/ran-do-ran-templates/-/tree/main'
    );
    await expect(browser.openGitlabLink).toHaveAttribute('target', '_blank');
    await expect(browser.openGitlabLink).toHaveAttribute('rel', /noopener/);
  });

  test('expanding a folder lazily loads its children', async ({ page }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    const folder = browser.nodeButton(Q1);
    await expect(folder).toHaveAttribute('aria-expanded', 'false');
    await expect(browser.row(`${Q1}/activation`)).toHaveCount(0);

    await folder.click();

    // Served by getRanTemplates1.json (path=Ericsson_2024_Q1).
    await expect(browser.row(`${Q1}/activation`)).toBeVisible();
    await expect(browser.row(`${Q1}/termination`)).toBeVisible();
    await expect(folder).toHaveAttribute('aria-expanded', 'true');

    await folder.click();
    await expect(folder).toHaveAttribute('aria-expanded', 'false');
    await expect(browser.row(`${Q1}/activation`)).toHaveCount(0);
  });

  test('expands the second vendor folder independently of the first', async ({
    page,
  }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    const q3Folder = browser.nodeButton(Q3);
    await expect(q3Folder).toHaveAttribute('aria-expanded', 'false');

    await q3Folder.click();

    // Served by getRanTemplates2.json (path=Ericsson_2024_Q3).
    await expect(browser.row(`${Q3}/activation`)).toBeVisible();
    await expect(browser.row(`${Q3}/termination`)).toBeVisible();
    await expect(q3Folder).toHaveAttribute('aria-expanded', 'true');

    // Q1 stays collapsed — expanding one folder must not expand its sibling.
    await expect(browser.nodeButton(Q1)).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await expect(browser.row(`${Q1}/activation`)).toHaveCount(0);

    await browser.nodeButton(`${Q3}/activation`).click();

    // Served by getRanTemplates5.json (path=Ericsson_2024_Q3/activation).
    await expect(
      browser.row(`${Q3}/activation/BaseTemplate.jinja`)
    ).toBeVisible();
    await expect(
      browser.row(`${Q3}/activation/cell_config.jinja`)
    ).toBeVisible();
    await expect(
      browser.row(`${Q3}/activation/node_config.jinja`)
    ).toBeVisible();

    await browser.nodeButton(`${Q3}/termination`).click();

    // Served by getRanTemplates6.json (path=Ericsson_2024_Q3/termination).
    await expect(
      browser.row(`${Q3}/termination/SliceTerminationTemplate.jinja`)
    ).toBeVisible();
  });

  test('search narrows the loaded tree and clearing restores it', async ({
    page,
  }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    await expect(browser.row(Q3)).toBeVisible();

    // A root-level match: this exercises the plain filter over the already loaded nodes.
    // The deep path — matching inside a folder that was never expanded — is the test below.
    await browser.searchInput.fill('Q1');

    await expect(browser.row(Q1)).toBeVisible();
    // The assertion that makes the filter testable at all.
    await expect(browser.row(Q3)).toHaveCount(0);

    await browser.searchInput.clear();

    await expect(browser.row(Q1)).toBeVisible();
    await expect(browser.row(Q3)).toBeVisible();
  });

  test('search finds matches inside folders that were never expanded', async ({
    page,
  }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    // Only the three root entries are loaded, and none of them matches the query, so every
    // row asserted below can appear only after loadFullTree() has walked the repository in
    // the background. That walk is the whole point of the search box, and a filter over the
    // loaded nodes alone would leave this test red.
    await expect(browser.row(Q1)).toBeVisible();
    await expect(browser.row(`${Q1}/termination`)).toHaveCount(0);

    await browser.searchInput.fill('SliceTermination');

    await expect(
      browser.row(`${Q1}/termination/SliceTerminationTemplate.jinja`)
    ).toBeVisible();
    await expect(
      browser.row(`${Q3}/termination/SliceTerminationTemplate.jinja`)
    ).toBeVisible();
    // The matching file's ancestors are auto-expanded so the hit is actually reachable.
    await expect(browser.nodeButton(`${Q1}/termination`)).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    // Branches without a match are dropped, at every depth.
    await expect(browser.row(`${Q1}/activation`)).toHaveCount(0);
    await expect(browser.row('README.md')).toHaveCount(0);

    await browser.searchInput.clear();

    await expect(browser.row('README.md')).toBeVisible();
    await expect(browser.row(`${Q1}/termination`)).toHaveCount(0);
  });

  test('adding a folder asks for confirmation and refreshes the tree', async ({
    page,
  }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    await browser.addFolderButton(Q1).click();

    // The inline row appears inside the now-expanded parent.
    await expect(browser.newFolderRow).toBeVisible();
    await expect(browser.saveFolderButton()).toBeDisabled();

    await browser.newFolderInput.fill('e2e_new_folder');
    await expect(browser.saveFolderButton()).toBeEnabled();
    await browser.saveFolderButton().click();

    await expect(
      page.getByRole('heading', { name: 'Save all changes?' })
    ).toBeVisible();
    await expect(
      page.getByText('Do you want to make a new directory?')
    ).toBeVisible();

    const createDirectory = page.waitForRequest(
      req =>
        req.url().includes('/api/ran-templates-manager/directory') &&
        req.method() === 'POST'
    );
    await page.getByRole('button', { name: 'Yes' }).click();
    await createDirectory;

    // Success closes the inline row; the tree reloads from the refresh trigger.
    await expect(browser.newFolderRow).toHaveCount(0);
    await expect(browser.tree).toBeVisible();
  });

  test('cancelling the new folder row discards it', async ({ page }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    // A real "no request fired" guard: treeData is never mutated locally on discard and the
    // tree fixtures are static, so `row('discard_me')).toHaveCount(0)` alone cannot tell "no
    // POST fired" apart from "a POST fired but the mock doesn't reflect it".
    const directoryRequests: string[] = [];
    page.on('request', request => {
      if (
        request.method() === 'POST' &&
        request.url().includes('/api/ran-templates-manager/directory')
      ) {
        directoryRequests.push(request.url());
      }
    });

    await browser.addFolderButton(Q1).click();
    await browser.newFolderInput.fill('discard_me');
    await browser.cancelFolderButton().click();

    await expect(browser.newFolderRow).toHaveCount(0);
    // Not row(): a discarded folder has no path in the tree, so a path lookup could never
    // fail. Matching the typed text catches an optimistically inserted row wherever it lands.
    await expect(page.getByText('discard_me')).toHaveCount(0);

    // networkidle rather than a web-first wait: the assertion is that a request is never made,
    // and there is no event to wait for when nothing happens.
    // eslint-disable-next-line playwright/no-networkidle
    await page.waitForLoadState('networkidle');
    expect(directoryRequests).toHaveLength(0);
  });

  test('Escape in the new folder input discards it', async ({ page }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    const directoryRequests: string[] = [];
    page.on('request', request => {
      if (
        request.method() === 'POST' &&
        request.url().includes('/api/ran-templates-manager/directory')
      ) {
        directoryRequests.push(request.url());
      }
    });

    await browser.addFolderButton(Q1).click();
    await browser.newFolderInput.fill('discard_me');
    await browser.newFolderInput.press('Escape');

    await expect(browser.newFolderRow).toHaveCount(0);
    // Not row(): a discarded folder has no path in the tree, so a path lookup could never
    // fail. Matching the typed text catches an optimistically inserted row wherever it lands.
    await expect(page.getByText('discard_me')).toHaveCount(0);

    // eslint-disable-next-line playwright/no-networkidle
    await page.waitForLoadState('networkidle');
    expect(directoryRequests).toHaveLength(0);
  });

  test('shows the backend error when creating a folder fails', async ({
    page,
  }) => {
    await page.route(
      url => url.pathname === '/api/ran-templates-manager/directory',
      async route => {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Directory already exists' }),
        });
      }
    );

    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    await browser.addFolderButton(Q1).click();
    await browser.newFolderInput.fill('e2e_new_folder');
    await browser.saveFolderButton().click();
    await page.getByRole('button', { name: 'Yes' }).click();

    // The component prefers err.error.detail over the generic fallback.
    await expect(page.getByText('Directory already exists')).toBeVisible();
    await expect(page.getByText('Failed to create directory')).toHaveCount(0);
  });

  test('add file navigates to the editor in add mode', async ({ page }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    await browser.addFileButton(Q1).click();

    await expect(page).toHaveURL(/\/ran-template\/edit\?/);
    await expect(page).toHaveURL(/mode=add/);
    await expect(page).toHaveURL(new RegExp(`templateSet=${Q1}(&|$)`));
    // ref decides which branch the new file is written to, and the template resolves it with
    // getDraftBranchName's substring match. For the folder Ericsson_2024_Q1 that is the first
    // draft whose name merely *contains* the folder name — the activation draft, not a draft
    // of the folder itself. Pinned because it is the branch the editor opens against; see the
    // note on the MR, this looks like a defect in getDraftBranchName rather than intent.
    await expect(page).toHaveURL(
      new RegExp(`ref=${ACTIVATION_DRAFT_LABEL}(&|$)`)
    );
  });

  test('selecting a draft branch disables nodes outside that draft', async ({
    page,
  }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    await browser.branchSelect.selectOption({ label: ACTIVATION_DRAFT_LABEL });

    await expect(page).toHaveURL(/ref=19cc078f/);
    await expect(browser.nodeButton(Q3)).toHaveAttribute(
      'aria-disabled',
      'true'
    );
    await expect(browser.addFolderButton(Q3)).toBeDisabled();
    await expect(browser.nodeButton(Q1)).not.toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  test('deleting a draft file confirms, calls the reset endpoint and reports success', async ({
    page,
  }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    // isSelectedDraftNode only re-enables a *file*'s own actions for a draft whose name is an
    // exact match on that file's normalized path — the folder-level draft used in the disabled-
    // nodes test above leaves every file inside the folder disabled. getRanTemplateDrafts.json
    // therefore also seeds a draft scoped to this one file, which is the one to select here.
    await browser.branchSelect.selectOption({ label: CELL_CONFIG_DRAFT_LABEL });
    await browser.nodeButton(Q1).click();
    await browser.nodeButton(`${Q1}/activation`).click();

    const draftFile = `${Q1}/activation/cell_config.jinja`;
    await expect(browser.badge(draftFile)).toHaveText('draft');

    await browser.deleteFileButton(draftFile).click();

    await expect(
      page.getByRole('heading', { name: 'Delete File?' })
    ).toBeVisible();

    const deleteDraft = page.waitForRequest(
      req =>
        req.method() === 'DELETE' &&
        req.url().includes('/api/ran-template-drafts/')
    );
    await page.getByRole('button', { name: 'Yes' }).click();
    const deleteRequest = await deleteDraft;

    // Which draft gets reset is the whole point: deleteRanTemplateDrafts.json answers 200 for
    // any name, and getDraftBranchName resolves the branch by substring, so resetting the
    // folder-wide activation draft instead of this one file would fire an equally successful
    // request. Assert the exact draft name, not just that a DELETE happened.
    expect(new URL(deleteRequest.url()).pathname).toBe(
      `/api/ran-template-drafts/${CELL_CONFIG_DRAFT_LABEL}`
    );

    await expect(page.getByText('File has been deleted.')).toBeVisible();
    // Deleting resets the selection back to the default branch.
    await expect(page).not.toHaveURL(/ref=19cc078f/);
  });

  test('shows the backend error when deleting a draft file fails', async ({
    page,
  }) => {
    // Two levels of lazy folder expansion plus a branch switch share the single ng
    // serve/WireMock instance with every other worker (see playwright.config.ts) — under
    // CI parallelism this occasionally needs more than the default budget. Triple it here
    // rather than globally, since only this test chains that many sequential loads.
    test.slow();

    await page.route(
      url =>
        url.pathname === `/api/ran-template-drafts/${CELL_CONFIG_DRAFT_LABEL}`,
      async route => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ title: 'Draft branch is locked' }),
        });
      }
    );

    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();

    await browser.branchSelect.selectOption({ label: CELL_CONFIG_DRAFT_LABEL });
    await browser.nodeButton(Q1).click();
    await browser.nodeButton(`${Q1}/activation`).click();
    await browser
      .deleteFileButton(`${Q1}/activation/cell_config.jinja`)
      .click();
    await page.getByRole('button', { name: 'Yes' }).click();

    // The component prefers err.error.title over the generic fallback — assert the fallback
    // itself is absent, not the unrelated success message, or a regression that surfaces the
    // fallback alongside (or instead of) the backend message would pass unnoticed.
    await expect(page.getByText('Draft branch is locked')).toBeVisible();
    await expect(page.getByText('Failed to delete file.')).toHaveCount(0);
  });

  test('refresh reloads both the tree and the draft list', async ({ page }) => {
    const browser = new RanTemplateFileBrowserPage(page);
    await browser.goto();
    await expect(browser.row(Q1)).toBeVisible();

    const treeReload = page.waitForRequest(
      req => req.url().includes('/api/ran-templates?') && req.method() === 'GET'
    );
    // The draft list is refetched too — that is what keeps the branch dropdown in sync with
    // drafts created elsewhere. Without it the tree reload alone would pass.
    const draftsReload = page.waitForRequest(
      req =>
        req.url().includes('/api/ran-template-drafts') && req.method() === 'GET'
    );
    await browser.refreshButton.click();
    await Promise.all([treeReload, draftsReload]);

    await expect(browser.row(Q1)).toBeVisible();
    await expect(
      browser.branchSelect.getByRole('option', {
        name: CELL_CONFIG_DRAFT_LABEL,
      })
    ).toHaveCount(1);
  });
});
