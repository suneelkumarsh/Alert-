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

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../../fixtures';

/**
 * Regression guard for the "Configuration tab never stops loading" bug.
 *
 * A single real Huawei node (KTDES-A-86204 on do4) returns ~1.5 MB of 3GPP
 * config that flattens to ~70,000 table rows. The shared tnap-data-table does
 * not slice its input, so before the fix the Configuration tab rendered every
 * row at once and blocked the browser main thread for minutes — the tab looked
 * frozen on an endless spinner even though the network call finished in a few
 * hundred milliseconds.
 *
 * ThreegppTableComponent now paginates client-side and hands the table only the
 * current page. This test replays the exact captured backend response and
 * asserts the tab becomes interactive quickly and renders a bounded number of
 * DOM rows.
 */

// Playwright runs from the project root, so resolve the fixture from there.
const LARGE_CONFIGDATA = JSON.parse(
  readFileSync(
    path.join(
      process.cwd(),
      'e2e',
      'tests',
      'treeview',
      'fixtures',
      'large-configdata-huawei-ne.json'
    ),
    'utf-8'
  )
);

// A page of 50 rows is the default; allow generous headroom for any layout
// helper rows. The point is that it must be tiny relative to the ~70k total.
const MAX_RENDERED_ROWS = 60;

// Time budget for the tab to become interactive after the (mocked, instant)
// response. Pre-fix this took minutes / never settled; post-fix it is well
// under a second, so 15s is a safe regression threshold on slow CI.
const READY_TIMEOUT_MS = 15000;

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

test.describe('Treeview Configuration - large dataset performance', () => {
  test.beforeEach(async ({ page }) => {
    // Serve the captured 1.5 MB / ~70k-row response for NODE_1's config call.
    await page.route('**/configdata?*', async route => {
      if (route.request().url().includes('selfLink=')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(LARGE_CONFIGDATA),
        });
        return;
      }
      await route.fallback();
    });
  });

  test('Configuration tab stays responsive and paginates a huge config', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    await page
      .locator('.qa_configurations_view_toggle #tab-table')
      .first()
      .click();

    // The table becomes visible quickly instead of hanging on the spinner.
    const table = page.locator('.qa_configurations_table');
    await expect(table).toBeVisible({ timeout: READY_TIMEOUT_MS });

    const rows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row)'
    );
    await expect(rows.first()).toBeVisible({ timeout: READY_TIMEOUT_MS });

    // Only one page of rows is rendered — not the full ~70k set.
    await expect
      .poll(async () => rows.count(), { timeout: READY_TIMEOUT_MS })
      .toBeLessThanOrEqual(MAX_RENDERED_ROWS);

    // Pagination is active: the widget reports the full total and shows a
    // multi-page status, proving only a slice of that total is rendered.
    await expect(
      page.locator('.qa_configurations_table').getByText(/Total Count:\s*\d/)
    ).toBeVisible();
    await expect(
      page.locator('.qa_configurations_table .app-table-pagination-status')
    ).toContainText(/of\s+\d/);
  });

  test('Navigating to the next page swaps in a new page of rows', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    await expect(page.locator('.qa_configurations_view_toggle')).toBeVisible({
      timeout: READY_TIMEOUT_MS,
    });

    await page
      .locator('.qa_configurations_view_toggle #tab-table')
      .first()
      .click();

    const rows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row)'
    );
    await expect(rows.first()).toBeVisible({ timeout: READY_TIMEOUT_MS });

    const firstRowBefore = ((await rows.first().textContent()) ?? '').trim();
    const countBefore = await rows.count();
    expect(countBefore).toBeLessThanOrEqual(MAX_RENDERED_ROWS);

    const status = page.locator(
      '.qa_configurations_table .app-table-pagination-status'
    );
    await expect(status).toContainText(/1\s*of\s+\d/);

    // Advance one page via the pagination "Next" control.
    await page
      .locator('.qa_configurations_table')
      .getByRole('link', { name: /next/i })
      .first()
      .click();

    // The status advances to page 2, the rendered rows change, and the page
    // stays bounded.
    await expect(status).toContainText(/2\s*of\s+\d/, {
      timeout: READY_TIMEOUT_MS,
    });
    await expect
      .poll(async () => ((await rows.first().textContent()) ?? '').trim(), {
        timeout: READY_TIMEOUT_MS,
      })
      .not.toBe(firstRowBefore);
    await expect
      .poll(async () => rows.count())
      .toBeLessThanOrEqual(MAX_RENDERED_ROWS);
  });
});
