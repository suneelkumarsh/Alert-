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

import { expect, Page, test } from '../../fixtures';
import { SITE_BY_ID_URL, stubTiles } from './map-test-utils';
import { treeRow } from '../treeview/rat-view.helpers';

/**
 * "Jump to Tree View" from a cell of the site pane (TNAP-32523).
 *
 * The reverse direction - tree → map - has been covered since the map was built, and it is the
 * direction that kept working: `/cell-site-map?cellId=…` is still read. This one wrote
 * `/treeview?nodeId=<cellId>`, a param nothing has read since TNAP-23563 replaced selection with
 * `selectedNodes`, so the tree opened with nothing selected and the user was left to search for the
 * cell by hand.
 *
 * Nothing caught that: the unit test asserted the broken URL, and no e2e test crossed the two
 * modules. Hence this spec spans both - it clicks the real button and then asserts inside the tree,
 * because the only thing that can tell a live param from a dead one is the tree reacting to it.
 *
 * Runs under the `local` project (node view). The RAT view resolves the same param through the
 * backend reveal instead, so covering it here would test the reveal endpoint, not the link.
 */

/**
 * The cell to jump to: a real cell of the node-view tree fixture, nested three levels deep in
 * `e2e/wiremock/mappings/treeview/getTreeview.json`.
 *
 * It has to be a tree cell rather than one of the map's own `TNAP_AREA_CELL_*` fixtures - those
 * exist only on the cell-sites side, and a jump to a cell the tree does not contain cannot show
 * anything selected, which is precisely the outcome this spec must be able to distinguish from the
 * bug. The site around it is stubbed here instead of shared, so the two fixture sets stay
 * independent.
 */
const TREE_CELL_ID = '445611193269501440';
// `as const` so the spread into treeRow(page, first, ...rest) keeps its first segment typed.
const TREE_CELL_PATH = [
  'service-instance:73000004',
  'pnf:e071d09a-1f6b-4c97-a374-91fbc6bbaa6a',
  `cell:${TREE_CELL_ID}`,
] as const;

const SITE_ID = 'Treeview_Jump_Site';
const SITE_LAT = 50.076382;
const SITE_LON = 14.408461;

function buildCell(cellId: string, cellName: string) {
  return {
    cellId,
    cellName,
    sitePhysicalLocationId: SITE_ID,
    radioAccessTechnology: 'NR',
    cellType: 'NRCellDU',
    nodeId: 'bbu-gnb-9239238',
    frequencyBand: 'n78',
    band: 'nr_3600',
    mcc: '230',
    mnc: '01',
    azimuth: 0,
    cellLocalId: Number(cellName),
    longitude: SITE_LON,
    latitude: SITE_LAT,
  };
}

/**
 * Two cells, the target listed **second**.
 *
 * The button sits in the row template, so the cell it navigates with comes from the row context.
 * A single-cell site would pass even if the template handed over the first cell of the table, or
 * the pane's own site - and "opens the tree on some cell" is not what the button promises.
 */
const OTHER_CELL = buildCell('445611193269501441', '84000014');
const TREE_CELL = buildCell(TREE_CELL_ID, '84000013');

const SITE = {
  physicalLocationId: SITE_ID,
  siteName: SITE_ID,
  insertType: 'Outdoor',
  street1: 'Janackovo nabrezi 1',
  city: 'Praha',
  postalCode: '11000',
  country: 'Czech Republic',
  region: '',
  longitude: SITE_LON,
  latitude: SITE_LAT,
  managedByTNAP: false,
  cellCount: 2,
  cells: [OTHER_CELL, TREE_CELL],
};

/** Both cells share one RAT/band/frequency, so the filter tree the map builds is this one entry. */
const FILTERS = {
  rats: [
    {
      id: 'nr',
      rat: TREE_CELL.radioAccessTechnology.toLowerCase(),
      bands: [
        {
          id: `nr-${TREE_CELL.band}`,
          band: TREE_CELL.band,
          frequencies: [
            {
              id: `nr-${TREE_CELL.band}-${TREE_CELL.frequencyBand}`,
              frequency: TREE_CELL.frequencyBand,
            },
          ],
        },
      ],
    },
  ],
};

/**
 * Serves the map from this spec rather than from the shared WireMock stubs, the way the canvas spec
 * does: the site has to carry a cell that exists in the *tree* fixture, and putting that pairing
 * into the shared mappings would make every other map spec depend on it.
 */
async function stubMap(page: Page): Promise<void> {
  await stubTiles(page);

  await page.route('**/api/cell-sites/filters*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FILTERS),
    });
  });

  // `sitesOnly` honoured the way portal-cell-sites does it - cells withheld below the cell render
  // zoom, `cellCount` kept - because that is the branch the pane takes at the zoom the map opens
  // at: it then fetches the cells itself through the site lookup below.
  await page.route('**/api/cell-sites/area*', async route => {
    const sitesOnly =
      new URL(route.request().url()).searchParams.get('sitesOnly') === 'true';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cellSites: [{ ...SITE, cells: sitesOnly ? [] : SITE.cells }],
      }),
    });
  });

  await page.route(SITE_BY_ID_URL, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cellSites: [SITE], totalCount: 1 }),
    });
  });
}

/**
 * The treeview detail pane fetches the selected cell. Stubbed because the tree fixture's cells have
 * no `/api/nodes/cells/…` mapping, and the 404 would raise an error alert over the tree - noise that
 * has nothing to do with the link. `selflink: null` is the honest value: no cell in the e2e fixture
 * set has one.
 */
async function stubTreeCellDetail(page: Page): Promise<void> {
  await page.route(`**/api/nodes/cells/${TREE_CELL_ID}`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cellId: TREE_CELL_ID,
        cellName: TREE_CELL.cellName,
        selflink: null,
      }),
    });
  });
}

/** Opens the site pane through the sidebar site list, which needs no map interaction. */
async function openSitePane(page: Page): Promise<void> {
  await page.goto('/cell-site-map');
  await expect(page.locator('.leaflet-container')).toBeVisible({
    timeout: 30000,
  });
  await page.locator('.qa_map_sidebar_site_list').click();
  await page.locator('.qa_site_list_open_detail').first().click();
  await expect(page.locator('.qa_site_pane')).toBeVisible();
}

test.describe('Cell Site Map - jump to Tree View', () => {
  test.beforeEach(async ({ page }) => {
    await stubMap(page);
    await stubTreeCellDetail(page);
  });

  test('selects the clicked cell in the tree', async ({ page }) => {
    await openSitePane(page);

    // Addressed through its own row instead of by index: the index would have to track the pane's
    // sort order, and the point of the assertion is which cell the row carries.
    const treeCellRow = page
      .locator('.qa_cell_table tbody tr:not(.loading-row)')
      .filter({ has: page.locator(`[data-cell-id="${TREE_CELL_ID}"]`) });
    await expect(treeCellRow).toHaveCount(1);

    await treeCellRow.locator('.qa_redirection_icon').click();

    await page.waitForURL(/\/treeview\?selectedNodes=/);
    // The dead params are asserted absent rather than the live set asserted exactly: the node view
    // merges `page`/`pageSize` into the URL a macrotask after it initialises, so pinning the whole
    // set races that sync. `nodeId` staying out is what the bug was about anyway.
    const params = new URL(page.url()).searchParams;
    expect(params.get('nodeId')).toBeNull();
    expect(params.get('nodeName')).toBeNull();
    expect(params.get('selectedNodes')).not.toBeNull();
    // toMatchObject, not toEqual: the tree rewrites this entry with the `path` it resolved the id
    // to, and whether that has landed by now depends on how fast the fixture loads. The rewrite
    // itself belongs to node-view-legacy-deep-link.spec.ts.
    expect(
      JSON.parse(decodeURIComponent(params.get('selectedNodes') ?? ''))[0]
    ).toMatchObject({
      id: TREE_CELL_ID,
      name: TREE_CELL.cellName,
      serviceType: 'cell',
      aaiType: 'cell',
    });

    await expect(page.locator('app-node-view')).toBeVisible();

    // The row existing at its composed key already means the two ancestors were expanded: the map
    // knows the id only, so the app had to resolve it against the loaded tree first.
    const row = treeRow(page, ...TREE_CELL_PATH);
    await expect(row).toBeVisible({ timeout: 30000 });

    // The value, not the presence - `aria-selected` is rendered on every row. This is the assertion
    // the bug fails: with `nodeId` the tree loads and nothing is ever selected.
    await expect(row).toHaveAttribute('aria-selected', 'true');
    // And only this row, so a reveal that selected the whole ancestor path would not pass either.
    await expect(
      page.locator('[role="treeitem"][aria-selected="true"]')
    ).toHaveCount(1);
  });
});
