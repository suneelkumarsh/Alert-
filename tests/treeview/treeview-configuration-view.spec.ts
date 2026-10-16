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

// `path` is the shape the app writes today. It is load-bearing for this spec rather than decoration:
// a path-less entry is resolved against the loaded tree and the URL is rewritten once, and because
// the detail pane is tracked by the composed key that rewrite re-creates the pane — dropping the tab
// the test had just opened. Whether it lands before or after the click depends on how long the tree
// takes, so the failure only shows under parallel load. Legacy path-less deep links are covered
// deliberately, and in one place, by node-view-legacy-deep-link.spec.ts.
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

/**
 * The config table is paginated, so the number of rendered `tbody tr`
 * elements is capped to the current page and no longer reflects the full
 * result set. When the total exceeds one page the data table shows a
 * pagination widget whose `.count` label carries the true total
 * (`collectionSize`); when it fits on a single page there is no widget and the
 * rendered rows already are the full set. This helper returns that true total
 * regardless of pagination state.
 */
async function configTotalRowCount(scope: {
  locator: (selector: string) => import('@playwright/test').Locator;
}): Promise<number> {
  const countLabel = scope
    .locator('.qa_configurations_table .paginationCount .count')
    .first();
  if ((await countLabel.count()) > 0 && (await countLabel.isVisible())) {
    return Number(((await countLabel.textContent()) ?? '').trim());
  }
  return scope
    .locator('.qa_configurations_table tbody tr:not(.loading-row)')
    .count();
}

/** Covers the deferred re-filter after expand/collapse all, with headroom for a slow CI worker. */
const TOGGLE_ALL_REFILTER_GRACE_MS = 1000;

test.describe('Treeview Configuration - Table and Tree Toggle', () => {
  test('Treeview footer shows total data count label', async ({ page }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const countLabel = page.locator('.qa_tree_data_count').first();
    await expect(countLabel).toBeVisible();

    const labelText = ((await countLabel.textContent()) || '').trim();
    const matches = labelText.match(/(\d+)/g);

    expect(matches).not.toBeNull();

    const totalCount = Number(matches?.at(-1));
    expect(Number.isNaN(totalCount)).toBeFalsy();
    expect(totalCount).toBeGreaterThanOrEqual(0);
  });

  test('Configuration table scrolls only inside data area', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    // Wait for the pane's default (tree) view before toggling, the same way the sibling
    // "defaults to tree and can switch to table view" test does. Clicking the toggle against a
    // still-initialising pane flaked under parallel load; the mechanism was never pinned down
    // (`viewMode` is written only by `onViewModeChange`, so it is not an `ngOnChanges` reset), so
    // read this as a wait for a rendered pane, not as a claim about what raced.
    await expect(
      page.locator('app-threegpp-treeview ng-treeview').first()
    ).toBeVisible();

    const tableToggleButton = page
      .locator('.qa_configurations_view_toggle #tab-table')
      .first();
    await tableToggleButton.click();
    await expect(tableToggleButton).toHaveClass(/active/);

    const tableScrollContainer = page
      .locator(
        'app-threegpp-table .qa_configurations_table .tnap-table-control-wrapper'
      )
      .first();
    await expect(tableScrollContainer).toBeVisible();

    const canScroll = await tableScrollContainer.evaluate(element => {
      const el = element as HTMLElement;
      return el.scrollHeight > el.clientHeight;
    });
    expect(canScroll).toBeTruthy();

    const outerWrapper = page
      .locator('app-threegpp-table .config-table-wrapper')
      .first();
    const outerBefore = await outerWrapper.evaluate(element => {
      const el = element as HTMLElement;
      return el.scrollTop;
    });

    await tableScrollContainer.evaluate(element => {
      const el = element as HTMLElement;
      el.scrollTop = el.scrollHeight;
    });

    await expect
      .poll(async () => {
        return tableScrollContainer.evaluate(element => {
          const el = element as HTMLElement;
          return el.scrollTop;
        });
      })
      .toBeGreaterThan(0);

    const outerAfter = await outerWrapper.evaluate(element => {
      const el = element as HTMLElement;
      return el.scrollTop;
    });

    expect(outerAfter).toBe(outerBefore);
  });

  test('Configuration tab defaults to tree and can switch to table view', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    const tableToggleButton = page
      .locator('.qa_configurations_view_toggle #tab-table')
      .first();
    const treeToggleButton = page
      .locator('.qa_configurations_view_toggle #tab-tree')
      .first();

    await expect(treeToggleButton).toHaveClass(/active/);
    await expect(
      page.locator('app-threegpp-treeview ng-treeview').first()
    ).toBeVisible();

    await tableToggleButton.click();
    await expect(tableToggleButton).toHaveClass(/active/);
    await expect(page.locator('.qa_configurations_table')).toBeVisible();

    await expect(
      page.getByRole('columnheader', { name: 'MO Type/Class' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'MO id/path' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'attribute' })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'value' })
    ).toBeVisible();

    const searchInput = page.locator('.qa_configurations_search input').first();
    await searchInput.fill('gn');
    await expect(
      page
        .locator('.qa_configurations_table tbody tr:not(.loading-row)')
        .first()
    ).toBeVisible();
    await expect(
      page.locator('.qa_configurations_table tbody').getByText('gNBId').first()
    ).toBeVisible();
    await expect(
      page
        .locator('.qa_configurations_table tbody')
        .getByText('83017746')
        .first()
    ).toBeVisible();

    await treeToggleButton.click();
    await expect(treeToggleButton).toHaveClass(/active/);
    await expect(
      page.locator('app-threegpp-treeview ng-treeview').first()
    ).toBeVisible();
    await expect(
      page.locator('.qa_configurations_search input').first()
    ).toHaveValue('gn');
    await expect(
      page
        .locator('app-threegpp-treeview-view')
        .locator('.tree-node, .qa_instance_node')
        .first()
    ).toBeVisible();

    await page
      .locator('.qa_configurations_search input')
      .first()
      .fill('not-existing-filter-value');
    await expect(
      page
        .locator('app-threegpp-treeview-view')
        .getByText('No match to the given filter criteria.')
    ).toBeVisible();

    await tableToggleButton.click();
    await expect(tableToggleButton).toHaveClass(/active/);
    await expect(
      page.locator('.qa_configurations_search input').first()
    ).toHaveValue('not-existing-filter-value');
    await expect(
      page
        .locator('.qa_configurations_table')
        .getByText('No match to the given filter criteria.')
    ).toBeVisible();
  });

  test('Expand all keeps the active search filter in the tree', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    await page.locator('.qa_network_tab_name').click();

    const treeview = page.locator('app-threegpp-treeview-view');
    await expect(treeview.locator('ng-treeview')).toBeVisible();

    const searchInput = page.locator('.qa_configurations_search input').first();
    await searchInput.fill('rrmpolicyratio');

    const match = treeview.getByText('RRMPolicyRatio', { exact: true });
    const nonMatch = treeview.getByText('GNBCUUPFunction', { exact: true });
    await expect(match.first()).toBeVisible();
    await expect(nonMatch).toHaveCount(0);

    const toggleAll = treeview.locator('.qa_tree_toggle_all');
    await toggleAll.click();
    await expect(toggleAll).toHaveClass(/qa_tree_collapse_all/);

    // The re-applied filter is deferred to the next macrotask, so the tree is briefly unfiltered
    // even when this works. Without the grace period `toHaveCount(0)` is satisfied by the very
    // first sample and passes whether the filter survives or not.
    // eslint-disable-next-line playwright/no-wait-for-timeout
    await page.waitForTimeout(TOGGLE_ALL_REFILTER_GRACE_MS);

    // The tree used to re-flatten with every node visible here, so the sibling branch came back
    // while the search box still held the term - filter text on top of an unfiltered tree.
    await expect(searchInput).toHaveValue('rrmpolicyratio');
    await expect(nonMatch).toHaveCount(0);
    await expect(match.first()).toBeVisible();
  });

  test('Expand/collapse all button does not overlap the tree scrollbar', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    await page.locator('.qa_network_tab_name').click();

    const treeview = page.locator('app-threegpp-treeview-view');
    const tree = treeview.locator('ng-treeview');
    await expect(tree).toBeVisible();

    const toggleAll = treeview.locator('.qa_tree_toggle_all');
    await toggleAll.click();
    await expect(toggleAll).toHaveClass(/qa_tree_collapse_all/);

    // The scrollbar runs down the tree's right edge, so any vertical overlap with the tree box
    // puts the button over the scrollbar's upper end.
    const toggleBottom = await toggleAll.evaluate(
      el => el.getBoundingClientRect().bottom
    );
    const treeTop = await tree.evaluate(el => el.getBoundingClientRect().top);
    expect(toggleBottom).toBeLessThanOrEqual(treeTop);
  });

  test('Synchronized search works across panes and starts from 3 characters', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1, NODE_2]));

    const panes = page.locator('app-treeview-detail');
    await expect(panes).toHaveCount(2);

    const firstPane = panes.nth(0);
    const secondPane = panes.nth(1);

    await firstPane.locator('.qa_network_tab_name').click();
    await secondPane.locator('.qa_network_tab_name').click();

    await firstPane.locator('.qa_configurations_view_toggle #tab-tree').click();
    await expect(
      firstPane.locator('.qa_configurations_view_toggle #tab-tree')
    ).toHaveClass(/active/);

    // secondPane defaults to tree; switch it to table so the table rows are visible.
    await secondPane
      .locator('.qa_configurations_view_toggle #tab-table')
      .click();
    await expect(
      secondPane.locator('.qa_configurations_view_toggle #tab-table')
    ).toHaveClass(/active/);

    const synchronizedInput = page.locator('.qa_synchronized_search input');
    await expect(synchronizedInput).toBeVisible();

    // Min 3 chars: 2-char input must not propagate into pane filters.
    await synchronizedInput.fill('ma');
    await expect(
      firstPane.locator('.qa_configurations_search input')
    ).toHaveValue('');
    await expect(
      secondPane.locator('.qa_configurations_search input')
    ).toHaveValue('');

    // 3-char input propagates to all panes and filters both views.
    await synchronizedInput.fill('man');
    await expect(
      firstPane.locator('.qa_configurations_search input')
    ).toHaveValue('man');
    await expect(
      secondPane.locator('.qa_configurations_search input')
    ).toHaveValue('man');

    await expect(
      secondPane
        .locator('.qa_configurations_table tbody tr:not(.loading-row)')
        .first()
    ).toBeVisible();
    await expect(
      firstPane.locator('app-threegpp-treeview-view ng-treeview')
    ).toBeVisible();
    await expect(
      firstPane.getByText('No match to the given filter criteria.')
    ).toHaveCount(0);
  });

  test('MO Type/Class filter dropdown filters table rows', async ({ page }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    await page
      .locator('.qa_configurations_view_toggle #tab-table')
      .first()
      .click();
    await expect(page.locator('.qa_configurations_table')).toBeVisible();
    const tableRows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row)'
    );
    await expect(tableRows.first()).toBeVisible();
    const initialRowCount = await tableRows.count();

    // Open MO Type/Class filter dropdown
    const moFilterTrigger = page.locator(
      '.qa_filter_mo_type_class button.btn-link'
    );
    await moFilterTrigger.click();

    // Dropdown is rendered in body due to container="body"
    const dropdownMenu = page.locator('body > div .dropdown-menu').last();
    await expect(dropdownMenu).toBeVisible();

    // Select "GNBDUFunction" option
    await dropdownMenu
      .locator('.dropdown-item', { hasText: 'GNBDUFunction' })
      .click();

    // Table should now only show GNBDUFunction rows
    const filteredRows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row)'
    );
    await expect
      .poll(async () => filteredRows.count())
      .toBeLessThan(initialRowCount);

    // Verify all visible rows belong to GNBDUFunction
    const rowTexts = await filteredRows.allTextContents();
    for (const text of rowTexts) {
      expect(text).toContain('GNBDUFunction');
    }

    // Filter icon should be active
    await expect(
      page.locator('.qa_filter_mo_type_class .filter-icon--active')
    ).toBeVisible();

    // Reset filter by selecting "ALL"
    await moFilterTrigger.click();
    const resetDropdown = page.locator('body > div .dropdown-menu').last();
    await expect(resetDropdown).toBeVisible();
    await resetDropdown.locator('.dropdown-item').first().click();

    // Table should show all rows again
    await expect(tableRows).toHaveCount(initialRowCount);
  });

  test('Attribute filter dropdown filters table rows', async ({ page }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    await expect(page.locator('.qa_configurations_view_toggle')).toBeVisible({
      timeout: 10000,
    });
    const tableTab = page.locator('#tab-table');
    await expect(tableTab).toBeVisible();
    await expect(tableTab).toBeEnabled();
    await tableTab.click();

    await expect(page.locator('.qa_configurations_table')).toBeVisible({
      timeout: 30000,
    });
    const tableRows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row)'
    );
    await expect(tableRows.first()).toBeVisible();
    const initialRowCount = await tableRows.count();

    // Open Attribute filter dropdown
    const attrFilterTrigger = page.locator(
      '.qa_filter_attribute button.btn-link'
    );
    await attrFilterTrigger.click();

    const dropdownMenu = page.locator('body > div .dropdown-menu').last();
    await expect(dropdownMenu).toBeVisible();

    // Select "gNBId" option
    await dropdownMenu
      .getByRole('button', { name: 'gNBId', exact: true })
      .click();

    // Table should be filtered to only gNBId rows
    const filteredRows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row)'
    );
    await expect
      .poll(async () => filteredRows.count())
      .toBeLessThan(initialRowCount);

    // Verify all visible rows contain gNBId
    const rowTexts = await filteredRows.allTextContents();
    for (const text of rowTexts) {
      expect(text).toContain('gNBId');
    }

    // Filter icon should be active
    await expect(
      page.locator('.qa_filter_attribute .filter-icon--active')
    ).toBeVisible();

    // Reset filter
    await attrFilterTrigger.click();
    const resetDropdown = page.locator('body > div .dropdown-menu').last();
    await expect(resetDropdown).toBeVisible();
    await resetDropdown.locator('.dropdown-item').first().click();

    await expect(tableRows).toHaveCount(initialRowCount);
  });

  test('Search and dropdown filters work together', async ({ page }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    await page
      .locator('.qa_configurations_view_toggle #tab-table')
      .first()
      .click();
    await expect(page.locator('.qa_configurations_table')).toBeVisible();
    const tableRows = page.locator(
      '.qa_configurations_table tbody tr:not(.loading-row)'
    );
    await expect(tableRows.first()).toBeVisible();
    // Use the paginated total, not the rendered (page-capped) row count.
    const initialTotal = await configTotalRowCount(page);

    // Step 1: Apply MO Type/Class filter
    const moFilterTrigger = page.locator(
      '.qa_filter_mo_type_class button.btn-link'
    );
    await moFilterTrigger.click();
    const moDropdown = page.locator('body > div .dropdown-menu').last();
    await expect(moDropdown).toBeVisible();
    await moDropdown.locator('.dropdown-item', { hasText: 'NRCellDU' }).click();

    await expect
      .poll(async () => configTotalRowCount(page))
      .toBeLessThan(initialTotal);
    const afterMoFilterTotal = await configTotalRowCount(page);

    // Step 2: Additionally apply text search
    const searchInput = page.locator('.qa_configurations_search input').first();
    await searchInput.fill('nRTAC');

    // Wait for search filter to take effect — total must decrease
    await expect
      .poll(async () => configTotalRowCount(page))
      .toBeLessThan(afterMoFilterTotal);

    // Verify filtered table shows nRTAC content
    await expect(
      page.locator('.qa_configurations_table tbody').getByText('nRTAC').first()
    ).toBeVisible();

    // All rendered rows should belong to NRCellDU
    const rowTexts = await tableRows.allTextContents();
    for (const text of rowTexts) {
      expect(text).toContain('NRCellDU');
    }

    // Step 3: Clear search via clear button, dropdown filter should remain
    const clearButton = page
      .locator('.qa_configurations_search .qa_reset_search_input')
      .first();
    await clearButton.click();

    await expect(searchInput).toHaveValue('');
    await expect
      .poll(async () => configTotalRowCount(page))
      .toBe(afterMoFilterTotal);

    // MO Type/Class filter icon should still be active
    await expect(
      page.locator('.qa_filter_mo_type_class .filter-icon--active')
    ).toBeVisible();

    // Step 4: Reset dropdown filter — all rows should return
    await moFilterTrigger.click();
    const resetDropdown = page.locator('body > div .dropdown-menu').last();
    await expect(resetDropdown).toBeVisible();
    await resetDropdown.locator('.dropdown-item').first().click();

    await expect.poll(async () => configTotalRowCount(page)).toBe(initialTotal);
  });

  // Empty-state coverage map:
  // 1) table no-data state: backend returns no config rows => message inside .qa_configurations_table
  // 2) table no-results state: search term yields no rows => message inside .qa_configurations_table
  // 3) table filter dependency: incompatible dropdown combination is prevented
  // 4) tree no-results branch: tree search yields no matching nodes => app-threegpp-treeview-view .qa_configurations_no_results

  test('Table shows no-data message when config data is empty', async ({
    page,
  }) => {
    await page.route('**/configdata?*', async route => {
      const requestUrl = route.request().url();
      if (requestUrl.includes('selfLink=')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({}),
        });
        return;
      }

      await route.fallback();
    });

    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    const tableToggle = page.locator(
      '.qa_configurations_view_toggle #tab-table'
    );
    await expect(tableToggle).toBeVisible();
    await tableToggle.click();

    await expect(page.locator('.qa_configurations_table')).toBeVisible();
    await expect(
      page.locator('.qa_configurations_table').getByText('No data available.')
    ).toBeVisible();
    await expect(page.locator('.qa_configurations_no_results')).toHaveCount(0);
  });

  test('Table shows no-results empty state when search has no matches', async ({
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
    await expect(page.locator('.qa_configurations_table')).toBeVisible();

    const searchInput = page.locator('.qa_configurations_search input').first();
    await searchInput.fill('this-will-not-match');

    await expect(
      page
        .locator('.qa_configurations_table')
        .getByText('No match to the given filter criteria.')
    ).toBeVisible();
  });

  test('Table dropdown filters are dependent and prevent non-overlapping combinations', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    await expect(
      page.locator('app-threegpp-treeview ng-treeview').first()
    ).toBeVisible();

    const tableToggle = page
      .locator('.qa_configurations_view_toggle #tab-table')
      .first();

    await expect(tableToggle).toBeVisible({
      timeout: 30000,
    });
    await tableToggle.click();

    await expect(page.locator('.qa_configurations_table')).toBeVisible();

    const moFilterTrigger = page.locator(
      '.qa_filter_mo_type_class button.btn-link'
    );
    await moFilterTrigger.click();
    const moDropdown = page.locator('body > div .dropdown-menu').last();
    await expect(moDropdown).toBeVisible();
    await moDropdown
      .locator('.dropdown-item', { hasText: 'ManagedElement' })
      .click();

    const attrFilterTrigger = page.locator(
      '.qa_filter_attribute button.btn-link'
    );
    await attrFilterTrigger.click();
    const attrDropdown = page.locator('body > div .dropdown-menu').last();
    await expect(attrDropdown).toBeVisible();

    // With MO Type/Class=ManagedElement, only overlapping attributes are offered.
    await expect(
      attrDropdown.getByRole('button', { name: 'swVersion', exact: true })
    ).toBeVisible();
    await expect(
      attrDropdown.getByRole('button', { name: 'gNBId', exact: true })
    ).toHaveCount(0);
  });

  test('Tree view shows no-results empty state when search has no matches', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible({ timeout: 15000 });
    await configurationTab.click();

    await page
      .locator('.qa_configurations_view_toggle #tab-tree')
      .first()
      .click();

    const searchInput = page.locator('.qa_configurations_search input').first();
    await searchInput.fill('this-will-not-match');

    await expect(
      page.locator('app-threegpp-treeview-view .qa_configurations_no_results')
    ).toBeVisible();
  });

  // AC1/AC3: the Configuration tab is shown for every supported node type — PNF, Cell and the three
  // generic-vnf RAN flavours (eNodeB / gNodeB / BTS) — and shows that node's *own* CPS data.
  //
  // A `toBeVisible()` on the tab is not enough on its own: the tab is rendered by an `@if` on
  // `metadata.type` alone, so it appears for every type that is not GNB/BBU/NMS whether or not the
  // node can actually resolve configuration. The rendered MO content is what proves the whole chain
  // ran — node lookup → selflink → CPS fetch → flattening — so each type below is asserted on a
  // value only its own fixture carries.

  test('Configuration tab renders the PNF (physical BBU) node CPS data', async ({
    page,
  }) => {
    // NODE_1 has aaiType 'pnf' and serviceType 'pnf', representing a physical BBU unit.
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    // The tree view is the default. Its root row is the top-level MO key of the CPS document, so
    // it can only read ManagedElement if the PNF's selflink resolved to this PNF's anchor.
    await expect(
      page.locator('app-threegpp-treeview-view ng-treeview')
    ).toBeVisible();

    await page
      .locator('.qa_configurations_view_toggle #tab-table')
      .first()
      .click();

    // gNBId 83017746 belongs to 73000005 alone; the second PNF fixture carries 83000436. So this
    // also rules out the panes sharing one cached response.
    // Both rows are searched for first: the table is paginated, so an unfiltered locator only sees
    // whatever landed on the current page and would fail for a fixture-ordering reason.
    const searchInput = page.locator('.qa_configurations_search input').first();
    await searchInput.fill('gNBId');
    await expect(
      page
        .locator('.qa_configurations_table tbody')
        .getByText('83017746')
        .first()
    ).toBeVisible();

    await searchInput.fill('nRTAC');
    await expect(
      page
        .locator('.qa_configurations_table tbody tr:not(.loading-row)')
        .filter({ hasText: 'GNBDUFunction=1/NRCellDU=84000019' })
        .filter({ hasText: 'nRTAC' })
        .first()
    ).toContainText('32005');
  });

  test('Configuration tab explains itself for a Cell node with no self-link', async ({
    page,
  }) => {
    // Path-scoped for the reason given at the top of this file. This cell is the one node here that
    // sits three levels deep in getTreeview.json, so a path-less entry is resolvable and therefore
    // does get rewritten.
    const CELL_NODE = {
      id: '445611193269501440',
      name: '84000013',
      serviceType: 'cell',
      aaiType: 'cell',
      path: [
        'service-instance:73000004',
        'pnf:e071d09a-1f6b-4c97-a374-91fbc6bbaa6a',
        'cell:445611193269501440',
      ],
    };

    // Mock the cell node API so the app does not receive a 404. `selflink: null` is not a contrived
    // case: AAI leaves the attribute optional and no cell in the e2e fixture set has one, which is
    // why this asserts the documented empty state rather than rendered MO rows.
    await page.route('**/api/nodes/cells/445611193269501440', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          cellId: '445611193269501440',
          selflink: null,
        }),
      });
    });

    const configRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/configdata')) {
        configRequests.push(request.url());
      }
    });

    await page.goto(buildTreeviewUrl([CELL_NODE]));

    // The Configuration Tab must be visible for Cell nodes.
    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    // The live-data message, not the planning one: noDataMessage() branches on the same
    // isPlanningSelfLinkData() input the fetch does, so the wrong string here means the two drifted
    // and the user is told the wrong attribute is missing.
    await expect(
      page
        .locator('app-threegpp-treeview app-empty')
        .getByText(
          'Configuration can’t be loaded (selflink attribute has empty value)'
        )
    ).toBeVisible();

    // The empty state replaces the whole pane — a search box or view toggle left behind would
    // filter nothing and toggle between two empty views.
    await expect(
      page.locator('app-threegpp-treeview .qa_configurations_search')
    ).toHaveCount(0);
    await expect(
      page.locator('app-threegpp-treeview .qa_configurations_view_toggle')
    ).toHaveCount(0);

    // ngOnInit returns before wiring configData$, so CPS is never asked for `selfLink=undefined` —
    // which would surface as an error alert instead of this explanation.
    //
    // networkidle rather than a web-first wait: the assertion is that a request is never made, and
    // there is no event to wait for when nothing happens — a bare count check passes while the
    // request is still in flight, i.e. for the wrong reason.
    // eslint-disable-next-line playwright/no-networkidle
    await page.waitForLoadState('networkidle');
    expect(configRequests).toHaveLength(0);
  });

  // The three generic-vnf types share one aaiType and one endpoint (`/api/nodes/generic-vnfs/{id}`)
  // and differ only by `serviceType`, which is also what drives the tab's `@if`. Each fixture below
  // therefore returns a different vendor MO tree (ENBFunction / GNBDUFunction / BTSFunction), so a
  // regression that resolves the wrong node — or maps all three to one — fails on the content.
  //
  // No `path` here, unlike the rest of this file: these three ids exist only as detail-endpoint
  // fixtures and appear nowhere in getTreeview.json, so there is no tree position to resolve them
  // against and the URL is left as given. Adding a made-up path would assert a tree shape the stub
  // does not have.
  const GENERIC_VNF_NODES = [
    {
      label: 'eNodeB',
      node: {
        id: 'gvnf-e2e-enb',
        name: 'enb-vnf-e2e-01',
        serviceType: 'eNodeB',
        aaiType: 'generic-vnf',
      },
      moPath: 'ENBFunction=1/EUtranCellFDD=84061001',
      attribute: 'tac',
      value: '21005',
    },
    {
      label: 'gNodeB',
      node: {
        id: 'gvnf-e2e-gnb',
        name: 'gnb-vnf-e2e-02',
        serviceType: 'gNodeB',
        aaiType: 'generic-vnf',
      },
      moPath: 'GNBDUFunction=1/NRCellDU=84062002',
      attribute: 'nRTAC',
      value: '32777',
    },
    {
      label: 'BTS',
      node: {
        id: 'gvnf-e2e-bts',
        name: 'bts-vnf-e2e-03',
        serviceType: 'BTS',
        aaiType: 'generic-vnf',
      },
      moPath: 'BTSFunction=1/GsmCell=84063003',
      attribute: 'lac',
      value: '10405',
    },
  ];

  for (const { label, node, moPath, attribute, value } of GENERIC_VNF_NODES) {
    test(`Configuration tab renders CPS data for a ${label} node`, async ({
      page,
    }) => {
      await page.goto(buildTreeviewUrl([node]));

      // The heading proves the generic-vnf lookup itself resolved: mapServiceTypeToNodeType has to
      // map this serviceType to GENERIC_VNF, and an unmapped one warns and fetches nothing.
      await expect(
        page.getByRole('heading', { level: 2, name: node.name })
      ).toBeVisible();

      const detail = page.locator('app-treeview-detail');
      await expect(
        detail.getByRole('tab', { name: 'Network', exact: true })
      ).toHaveCount(1);
      // No Plan tab for a generic-vnf: showPlanTab() allows service-instance, pnf and cell only.
      await expect(
        detail.getByRole('tab', { name: 'Plan', exact: true })
      ).toHaveCount(0);

      await detail.getByRole('tab', { name: 'Network', exact: true }).click();
      await page
        .locator('.qa_configurations_view_toggle #tab-table')
        .first()
        .click();

      const row = page
        .locator('.qa_configurations_table tbody tr:not(.loading-row)')
        .filter({ hasText: moPath })
        .filter({ hasText: attribute });
      await expect(row.first()).toBeVisible();
      await expect(row.first()).toContainText(value);
    });
  }

  // AC7: Table shows representative flattened rows: scalar, nested list-of-objects (index notation),
  // and a deeply nested child MO whose moIdPath includes the parent segment.

  test('Configuration table flattens nested and list-based attributes into representative rows', async ({
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
    await expect(page.locator('.qa_configurations_table')).toBeVisible();
    await expect(
      page
        .locator('.qa_configurations_table tbody tr:not(.loading-row)')
        .first()
    ).toBeVisible();

    // AC7a: Simple scalar attribute — GNBCUUPFunction=1 / gNBId / 83017746
    const gNBIdRow = page
      .locator('.qa_configurations_table tbody tr:not(.loading-row)')
      .filter({ hasText: 'GNBCUUPFunction=1' })
      .filter({ hasText: 'gNBId' });
    await expect(gNBIdRow.first()).toBeVisible();
    await expect(gNBIdRow.first()).toContainText('83017746');

    // AC7b: List-based attribute (array of objects) — pLMNInfoList is expanded with
    // index notation: pLMNInfoList[0].sd / 000001
    const pLMNRow = page
      .locator('.qa_configurations_table tbody tr:not(.loading-row)')
      .filter({ hasText: 'GNBCUUPFunction=1' })
      .filter({ hasText: 'pLMNInfoList[0].sd' });
    await expect(pLMNRow.first()).toBeVisible();
    await expect(pLMNRow.first()).toContainText('000001');

    // AC7c: Nested child MO — NRCellDU lives inside GNBDUFunction; its moIdPath
    // must carry the full 3GPP Distinguished Name path including the parent segment.
    // The table is paginated, so narrow to the nRTAC rows first to make the
    // target row deterministically land on the first page.
    await page.locator('.qa_configurations_search input').first().fill('nRTAC');
    const nRTACRow = page
      .locator('.qa_configurations_table tbody tr:not(.loading-row)')
      .filter({ hasText: 'GNBDUFunction=1/NRCellDU=84000019' })
      .filter({ hasText: 'nRTAC' });
    await expect(nRTACRow.first()).toBeVisible();
    await expect(nRTACRow.first()).toContainText('32005');
  });

  test('Tree view shows the values of a list-of-strings attribute', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    const treeView = page.locator('app-threegpp-treeview-view');
    await expect(treeView.locator('ng-treeview')).toBeVisible();

    // Filtering instead of clicking down five levels of chevrons - the tree expands the ancestors
    // of a match, and expandAndShowAllChildren then reveals every descendant.
    await page
      .locator('.qa_configurations_search input')
      .first()
      .fill('reservedBy');

    // Every element of a list of strings is a row of its own, labelled with its index. Before
    // TNAP-32602 those rows showed the index alone and the value behind them was unreachable,
    // because the row was not expandable.
    await expect(treeView.locator('.qa_config_tree_attribute')).toHaveText([
      '0:',
      '1:',
    ]);
    await expect(treeView.locator('.qa_config_tree_value')).toHaveText([
      'ManagedElement=73000005,GNBCUCPFunction=1,NRCellCU=84000019',
      'ManagedElement=73000005,GNBDUFunction=1,NRSectorCarrier=1',
    ]);
  });

  test('Tree view shows the id key next to the value of every object', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_2]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    const treeView = page.locator('app-threegpp-treeview-view');
    await expect(treeView.locator('ng-treeview')).toBeVisible();

    // Filtering expands the ancestors of a match, which is cheaper than clicking down four levels
    // of chevrons. Searching the bare identifier also proves the "id:" prefix did not break the
    // existing search.
    await page
      .locator('.qa_configurations_search input')
      .first()
      .fill('84000023');

    // The value on its own left the reader guessing which key it came from - and it must appear
    // only once.
    await expect(
      treeView
        .locator('.qa_config_tree_node_label')
        .filter({ hasText: 'id:84000023' })
    ).toHaveCount(1);
  });

  test('Tree view shows the id of a named object on a row of its own', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_2]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    const treeView = page.locator('app-threegpp-treeview-view');
    await expect(treeView.locator('ng-treeview')).toBeVisible();

    await page
      .locator('.qa_configurations_search input')
      .first()
      .fill('73000006');

    // ManagedElement is a named object, not an array element: its key is the name, so the id
    // cannot go into the label and gets a row of its own directly below it - exactly once.
    await expect(
      treeView
        .locator('.qa_config_tree_node_label')
        .filter({ hasText: 'id:73000006' })
    ).toHaveCount(1);
  });

  test('Tree view leaves objects without an id unchanged', async ({ page }) => {
    await page.goto(buildTreeviewUrl([NODE_2]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    const treeView = page.locator('app-threegpp-treeview-view');
    await expect(treeView.locator('ng-treeview')).toBeVisible();

    await page
      .locator('.qa_configurations_search input')
      .first()
      .fill('pLMNInfoList');

    // The entries of pLMNInfoList carry no id, so they keep their bare array index and must not
    // gain an invented "id:" label. A global "id:" count would fail here for a legitimate reason:
    // the filter keeps the matches' ancestors on screen, and those do have ids.
    await expect(
      treeView
        .locator('.qa_config_tree_node_label')
        .filter({ hasText: /^0$/ })
        .first()
    ).toBeVisible();
  });

  test('Tree view lists the section id, then attributes, then the remaining keys alphabetically', async ({
    page,
  }) => {
    await page.goto(buildTreeviewUrl([NODE_1]));

    const configurationTab = page.locator('.qa_network_tab_name');
    await expect(configurationTab).toBeVisible();
    await configurationTab.click();

    const treeView = page.locator('app-threegpp-treeview-view');
    await expect(treeView.locator('ng-treeview')).toBeVisible();

    // One level only: the tree is virtualised, so expanding everything would push the rows this
    // test asserts on out of the rendered viewport.
    const rootRow = treeView.getByRole('treeitem').first();
    await expect(rootRow).toContainText('ManagedElement');
    await rootRow.getByRole('button', { name: 'Expand' }).click();

    // The stub delivers ManagedElement as id, GNBCUUPFunction, GNBDUFunction, GNBCUCPFunction,
    // attributes - so every one of the three rules below moves a row.
    await expect(treeView.locator('.qa_config_tree_node_label')).toHaveText([
      'ManagedElement',
      'id:73000005',
      'attributes',
      'GNBCUCPFunction',
      'GNBCUUPFunction',
      'GNBDUFunction',
    ]);
  });
});
