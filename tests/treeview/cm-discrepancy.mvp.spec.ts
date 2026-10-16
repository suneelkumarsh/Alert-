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

import { test, expect, Page } from '../../fixtures';

const NODE_1 = {
  id: 'b64f1a7e-beef-4533-b467-1c9da22e75f2',
  name: '73000005',
  serviceType: 'pnf',
  aaiType: 'pnf',
};

const NODE_2 = {
  id: 'e87cdcf2-92b9-4910-9b27-855da95e043d',
  name: '73000006',
  serviceType: 'pnf',
  aaiType: 'pnf',
};

const TOTAL_DISCREPANCIES = 18;
const ACTIONABLE_DISCREPANCIES = 4;
const PROCESSED_DISCREPANCIES = TOTAL_DISCREPANCIES - ACTIONABLE_DISCREPANCIES;

function buildTreeviewUrl(
  nodes: { id: string; name: string; serviceType: string; aaiType: string }[]
): string {
  const selectedNodes = encodeURIComponent(JSON.stringify(nodes));
  return `/treeview?selectedNodes=${selectedNodes}`;
}

async function openCmActionsTab(page: Page) {
  const cmActionsTab = page.locator('.qa_cm_actions_tab_name').first();
  await expect(cmActionsTab).toBeVisible();
  await cmActionsTab.click();
  await expect(page.locator('app-cm-actions')).toBeVisible();
}

async function switchToDiscrepancyView(page: Page) {
  const segmentedControl = page.locator('.qa_cm_actions_view_toggle');
  await expect(segmentedControl).toBeVisible();
  await segmentedControl.getByText(/Discrepancies/).click();
  await expect(page.locator('app-treenode-discrepancy-list')).toBeVisible();
}

test.describe(
  'CM Actions - Discrepancy List (RAT operator / mvp_operator role)',
  { tag: '@mvpOperator' },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(buildTreeviewUrl([NODE_1]));
      await expect(page.locator('app-rat-view')).toBeVisible();
      await openCmActionsTab(page);
    });

    test('segmented control toggle is visible for RAT operator', async ({
      page,
    }) => {
      const segmentedControl = page.locator('.qa_cm_actions_view_toggle');
      await expect(segmentedControl).toBeVisible();
      await expect(segmentedControl.getByText('All CM actions')).toBeVisible();
      await expect(segmentedControl.getByText(/Discrepancies/)).toBeVisible();
    });

    test('discrepancy count badge reflects total items from API', async ({
      page,
    }) => {
      const discrepancyToggle = page
        .locator('.qa_cm_actions_view_toggle')
        .getByText(/Discrepancies/);
      await expect(discrepancyToggle).toHaveText(
        `Discrepancies (${TOTAL_DISCREPANCIES})`
      );
    });

    test('switching to discrepancy view renders the discrepancy list component', async ({
      page,
    }) => {
      await expect(page.locator('app-cm-action-changes-table')).toBeVisible();

      await switchToDiscrepancyView(page);

      await expect(page.locator('app-treenode-discrepancy-list')).toBeVisible();
      await expect(page.locator('app-cm-action-changes-table')).toBeHidden();
    });

    test('discrepancy list shows correct column headers', async ({ page }) => {
      await switchToDiscrepancyView(page);

      const actionableTable = page.locator(
        '.qa_discrepancy_list_table_actionable'
      );
      await expect(actionableTable).toBeVisible();

      for (const column of [
        /Status/i,
        /Manage Object/i,
        /Attribute/i,
        /Source Value/i,
        /Target Value/i,
      ]) {
        await expect(
          actionableTable.getByRole('columnheader', { name: column })
        ).toBeVisible();
      }
    });

    test('discrepancy list splits rows into actionable and processed tables', async ({
      page,
    }) => {
      await switchToDiscrepancyView(page);

      await expect(
        page.locator(
          '.qa_discrepancy_list_table_actionable tbody tr:not(.loading-row)'
        )
      ).toHaveCount(ACTIONABLE_DISCREPANCIES);
      await expect(
        page.locator(
          '.qa_discrepancy_list_table_other tbody tr:not(.loading-row)'
        )
      ).toHaveCount(PROCESSED_DISCREPANCIES);
    });

    test('section headings reflect correct counts', async ({ page }) => {
      await switchToDiscrepancyView(page);

      await expect(
        page.getByRole('heading', {
          name: `Discrepancies awaiting approval (${ACTIONABLE_DISCREPANCIES})`,
        })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', {
          name: `Processed Discrepancies (${PROCESSED_DISCREPANCIES})`,
        })
      ).toBeVisible();
    });

    test('approve controls ARE visible for RAT operator (has portal_operator → ran_operator passes)', async ({
      page,
    }) => {
      await switchToDiscrepancyView(page);

      await expect(
        page.locator('.qa_approve_waiting_for_approval_discrepancy')
      ).toHaveCount(ACTIONABLE_DISCREPANCIES);
      await expect(
        page.locator('.qa_approve_waiting_for_approval_discrepancy').first()
      ).toBeEnabled();

      // Bulk approve is disabled until a row is selected.
      await expect(
        page.locator('.qa_approve_all_waiting_for_approval_btn')
      ).toBeDisabled();
    });

    test('processed discrepancy table has no checkboxes and offers a view button', async ({
      page,
    }) => {
      await switchToDiscrepancyView(page);

      const processedTable = page.locator('.qa_discrepancy_list_table_other');
      await expect(processedTable).toBeVisible();
      await expect(
        processedTable.locator('tbody input[type="checkbox"]')
      ).toHaveCount(0);

      const viewButtons = processedTable.locator(
        'tbody tr:not(.loading-row) button'
      );
      await expect(viewButtons).toHaveCount(PROCESSED_DISCREPANCIES);
      await expect(viewButtons.first()).toBeEnabled();
    });

    test('actionable discrepancy table has checkboxes for bulk selection', async ({
      page,
    }) => {
      await switchToDiscrepancyView(page);

      const actionableTable = page.locator(
        '.qa_discrepancy_list_table_actionable'
      );
      await expect(actionableTable).toBeVisible();
      await expect(
        actionableTable.locator('tbody input[type="checkbox"]')
      ).toHaveCount(ACTIONABLE_DISCREPANCIES);
    });

    test('switching back to All CM actions hides the discrepancy list', async ({
      page,
    }) => {
      await switchToDiscrepancyView(page);
      await expect(page.locator('app-treenode-discrepancy-list')).toBeVisible();

      await page
        .locator('.qa_cm_actions_view_toggle')
        .getByText('All CM actions')
        .click();

      await expect(page.locator('app-cm-action-changes-table')).toBeVisible();
      await expect(page.locator('app-treenode-discrepancy-list')).toBeHidden();
    });

    test('single discrepancy approval flow with modal confirmation', async ({
      page,
    }) => {
      await switchToDiscrepancyView(page);
      await expect(
        page.locator('.qa_discrepancy_list_table_actionable')
      ).toBeVisible();

      const approveButton = page
        .locator('.qa_approve_waiting_for_approval_discrepancy')
        .first();
      const modal = page.locator('.modal-dialog');

      await approveButton.click();
      await expect(modal).toBeVisible();
      await expect(modal.locator('.qa_modal_title')).toHaveText(
        'Approve Discrepancy'
      );

      await modal.locator('.qa_cancel_button').click();
      await expect(modal).toBeHidden();
      await expect(approveButton).toBeVisible();

      await approveButton.click();
      await expect(modal).toBeVisible();
      await modal.locator('.qa_apply_button').click();
      await expect(modal).toBeHidden();

      await expect(page.locator('ngb-alert')).toContainText(
        'Successfully created approval request'
      );
    });

    test('bulk discrepancy approval flow with selection', async ({ page }) => {
      await switchToDiscrepancyView(page);
      await expect(
        page.locator('.qa_discrepancy_list_table_actionable')
      ).toBeVisible();

      const checkboxes = page.locator(
        '.qa_discrepancy_list_table_actionable tbody tr:not(.loading-row) input[type="checkbox"]'
      );
      await expect(checkboxes).toHaveCount(ACTIONABLE_DISCREPANCIES);
      await checkboxes.first().check();

      const bulkApproveButton = page.locator(
        '.qa_approve_all_waiting_for_approval_btn'
      );
      await expect(bulkApproveButton).toBeEnabled();
      await expect(bulkApproveButton).toContainText('(1)');

      const modal = page.locator('.modal-dialog');
      await bulkApproveButton.click();
      await expect(modal).toBeVisible();
      await expect(modal.locator('.qa_modal_title')).toHaveText(
        'Approve Discrepancy'
      );

      await modal.locator('.qa_cancel_button').click();
      await expect(modal).toBeHidden();
      await expect(checkboxes.first()).toBeChecked();

      await bulkApproveButton.click();
      await expect(modal).toBeVisible();
      await modal.locator('.qa_apply_button').click();
      await expect(modal).toBeHidden();

      await expect(page.locator('ngb-alert')).toContainText(
        'Successfully created approval request'
      );
      // A successful bulk approval clears the selection.
      await expect(checkboxes.first()).not.toBeChecked();
    });

    test('empty discrepancy stub shows zero counts in section headings', async ({
      page,
    }) => {
      // Override the WireMock stub with an empty response before navigating.
      await page.route('**/api/pnfs/**/discrepancy', route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ items: [] }),
        })
      );

      await page.goto(buildTreeviewUrl([NODE_1]));
      await expect(page.locator('app-rat-view')).toBeVisible();
      await openCmActionsTab(page);

      // With 0 items the toggle badge must show (0).
      await expect(
        page.locator('.qa_cm_actions_view_toggle').getByText(/Discrepancies/)
      ).toHaveText('Discrepancies');

      await switchToDiscrepancyView(page);

      await expect(
        page.getByRole('heading', {
          name: 'Discrepancies awaiting approval (0)',
        })
      ).toBeVisible();
      await expect(
        page.getByRole('heading', {
          name: 'Processed Discrepancies (0)',
        })
      ).toBeVisible();
    });
  }
);

test.describe(
  'CM Actions - Multiple Nodes (RAT operator)',
  { tag: '@mvpOperator' },
  () => {
    test('discrepancy list handles multiple nodes independently', async ({
      page,
    }) => {
      await page.goto(buildTreeviewUrl([NODE_1, NODE_2]));
      await expect(page.locator('app-rat-view')).toBeVisible();

      const panes = page.locator('app-treeview-detail');
      await expect(panes).toHaveCount(2);

      const firstPane = panes.nth(0);
      const secondPane = panes.nth(1);

      await firstPane.locator('.qa_cm_actions_tab_name').click();
      await expect(firstPane.locator('app-cm-actions')).toBeVisible();

      // Switch first pane to discrepancy view.
      const firstToggle = firstPane.locator('.qa_cm_actions_view_toggle');
      await expect(firstToggle).toBeVisible();
      await firstToggle.getByText(/Discrepancies/).click();
      await expect(
        firstPane.locator('app-treenode-discrepancy-list')
      ).toBeVisible();
      await expect(
        firstPane.locator('.qa_discrepancy_list_table_actionable')
      ).toBeVisible();

      await secondPane.locator('.qa_cm_actions_tab_name').click();
      await expect(secondPane.locator('app-cm-actions')).toBeVisible();

      const secondToggle = secondPane.locator('.qa_cm_actions_view_toggle');
      await expect(secondToggle).toBeVisible();
      await secondToggle.getByText(/Discrepancies/).click();
      await expect(
        secondPane.locator('app-treenode-discrepancy-list')
      ).toBeVisible();

      // Switching the second pane must not reset the first one.
      await expect(
        firstPane.locator('.qa_discrepancy_list_table_actionable')
      ).toBeVisible();
      await expect(
        secondPane.locator('.qa_discrepancy_list_table_actionable')
      ).toBeVisible();
    });
  }
);
