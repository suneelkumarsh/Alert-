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
import { DataTableTester } from '../../setup/data-table';

// Path-scoped, for the reason spelled out in treeview-configuration-view.spec.ts: a path-less entry
// makes the app rewrite the URL once the tree has loaded, and that re-creates the detail pane
// underneath the tab this spec opens.
const NODE_1 = {
  id: 'b64f1a7e-beef-4533-b467-1c9da22e75f2',
  name: '73000005',
  serviceType: 'pnf',
  aaiType: 'pnf',
  path: [
    'service-instance:73000005',
    'pnf:b64f1a7e-beef-4533-b467-1c9da22e75f2',
  ],
};

const NODE_2 = {
  id: 'e87cdcf2-92b9-4910-9b27-855da95e043d',
  name: '73000006',
  serviceType: 'pnf',
  aaiType: 'pnf',
  path: [
    'service-instance:73000006',
    'pnf:e87cdcf2-92b9-4910-9b27-855da95e043d',
  ],
};

function buildTreeviewUrl(
  nodes: {
    id: string;
    name: string;
    serviceType: string;
    aaiType: string;
    path?: string[];
  }[]
): string {
  const selectedNodes = encodeURIComponent(JSON.stringify(nodes));
  return `/treeview?selectedNodes=${selectedNodes}`;
}

async function openCmActionsTab(page: Page): Promise<void> {
  const cmActionsTab = page.locator('.qa_cm_actions_tab_name').first();
  await expect(cmActionsTab).toBeVisible();
  await cmActionsTab.click();
  await expect(page.locator('app-cm-actions')).toBeVisible();
}

test.describe('CM Actions - Component Toggle and Discrepancy List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));
    await openCmActionsTab(page);
  });

  test('CM Actions table is displayed by default', async ({ page }) => {
    await expect(page.locator('app-cm-action-changes-table')).toBeVisible();
  });

  test('segmented control toggle is NOT visible for test-admin (no mvp_operator / VIEW_CM_DISCREPANCY_LIST)', async ({
    page,
  }) => {
    // test-admin lacks mvp_operator → VIEW_CM_DISCREPANCY_LIST denied →
    await expect(page.locator('.qa_cm_actions_view_toggle')).toHaveCount(0);
  });

  test('discrepancy list component is not rendered without toggle', async ({
    page,
  }) => {
    // Without the toggle, viewMode stays at its default ('cmActions') and
    // app-treenode-discrepancy-list is never instantiated.
    await expect(page.locator('app-treenode-discrepancy-list')).toHaveCount(0);
  });

  test('table renders translated headers and the status filter', async ({
    page,
  }) => {
    const table = new DataTableTester(page);
    const thead = table.dataTable.locator('thead');

    // Asserted per label rather than as exact header text: the State header also holds the filter
    // dropdown's option labels, which are in the DOM while the dropdown is closed.
    await expect(table.headers).toHaveCount(5);
    await expect(thead).toContainText('Resource');
    await expect(thead).toContainText('State');
    await expect(thead).toContainText('Config Type');
    await expect(thead).toContainText('Executed Date');
    await expect(thead).toContainText('Action');
    await expect(thead).not.toContainText('cmAction.list.fields');

    await expect(
      table.dataTable.getByRole('button', { name: 'Filter' })
    ).toBeVisible();
  });

  test('table renders the stubbed CM action with its translated status and action button', async ({
    page,
  }) => {
    const table = new DataTableTester(page);

    await expect(table.dataRows).toHaveCount(1);

    // The status label and the action button both reach the table as projected templates. Without
    // them the table silently falls back to the raw column value — the status enum id and an empty
    // action cell — so assert the fallback is absent, not merely that a row exists.
    const row = table.dataRows.filter({ hasText: '73100114' });
    await expect(row).toContainText('Activation completed');
    await expect(row).not.toContainText('activation_completed');
    await expect(row.getByAltText('Open CM Action Details')).toBeVisible();
  });
});

test.describe('CM Actions - Multiple Nodes', () => {
  test('CM actions tab opens independently for each detail pane', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1, NODE_2]));

    const panes = page.locator('app-treeview-detail');
    await expect(panes).toHaveCount(2);

    const firstPane = panes.nth(0);
    const secondPane = panes.nth(1);

    await firstPane.locator('.qa_cm_actions_tab_name').click();
    await expect(firstPane.locator('app-cm-actions')).toBeVisible();
    await expect(
      firstPane.locator('app-cm-action-changes-table')
    ).toBeVisible();

    await secondPane.locator('.qa_cm_actions_tab_name').click();
    await expect(secondPane.locator('app-cm-actions')).toBeVisible();

    // Switching the second pane must not reset the first one.
    await expect(
      firstPane.locator('app-cm-action-changes-table')
    ).toBeVisible();
    await expect(
      secondPane.locator('app-cm-action-changes-table')
    ).toBeVisible();
  });
});

test.describe('CM Actions - Permission-based Behavior', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));
    await openCmActionsTab(page);
  });

  test('segmented control is absent without VIEW_CM_DISCREPANCY_LIST permission', async ({
    page,
  }) => {
    // VIEW_CM_DISCREPANCY_LIST requires pnfs_discrepancies_resource/GET,
    // gated on mvp_operator policy. test-admin has portal_operator but not
    // mvp_operator → permission denied → toggle not rendered.
    await expect(page.locator('.qa_cm_actions_view_toggle')).toHaveCount(0);
  });

  test('CM actions table renders without discrepancy permission', async ({
    page,
  }) => {
    // Even without VIEW_CM_DISCREPANCY_LIST, the CM actions table is always shown.
    await expect(page.locator('app-cm-action-changes-table')).toBeVisible();
  });

  test('Component initializes properly with permission token injection', async ({
    page,
  }) => {
    // The CM actions table must be visible immediately after tab activation —
    // no toggle interaction needed when the user lacks discrepancy permission.
    await expect(page.locator('app-cm-action-changes-table')).toBeVisible();
    await expect(page.locator('.qa_cm_actions_view_toggle')).toHaveCount(0);
  });
});
