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

/**
 * The map opens at zoom 13 while cells only render from zoom 14
 * (CELLS_ZOOM_DISPLAY_THRESHOLD), so below the threshold it asks
 * /api/cell-sites/area for `sitesOnly=true` and the response carries an empty
 * `cells` array with a still-accurate `cellCount`.
 *
 * That withheld-cells response shape is what these tests cover, because it is
 * where the UI can silently go wrong without erroring:
 *
 *  - `cells: []` makes `[].every(...)` vacuously TRUE, which reclassified every
 *    site from the SITE_CELLS layer into SITE_ONLY — a grey rectangle instead of
 *    a black triangle, at the zoom the map opens on.
 *  - the site list's Cells column read `cells.length`, so it showed 0 for every
 *    site until the user zoomed in.
 *
 * Neither shows up as an error, only as wrong pixels and wrong numbers, and the
 * shared WireMock fixture cannot reach them: it answers every bbox with the same
 * cells-included body and carries no `cellCount` at all. So these tests fulfill
 * /area themselves, honouring the `sitesOnly` parameter the way the backend does
 * (portal-cell-sites, TNAP-32079).
 *
 * The bodies are three real do4 sites (trimmed to one cell per RAT, `selflink`
 * dropped) rather than invented data, so the field spellings — `insertType:
 * 'Outdoor'` against a config that filters on `'outdoor'`, cells sharing the
 * site's own coordinates — are the ones the backend actually sends.
 */

/**
 * Site markers are drawn as SVG into this Leaflet pane. Cell coverage is not —
 * the wedges share one <canvas> in the same pane — so at the zooms this spec
 * drives, every path counted here is a site marker.
 */
const OVERLAY_PATHS = '.leaflet-overlay-pane path';

/**
 * The colours the site layers paint with (configuration.ts). A site whose cells
 * are withheld belongs to SITE_CELLS — a black triangle. The pre-fix bug moved
 * it to SITE_ONLY, a grey rectangle, so the colour is what distinguishes the two
 * classifications in the rendered SVG.
 */
const SITE_CELLS_COLOR = 'black';
const SITE_ONLY_COLOR = '#555555';

/**
 * Three real do4 cell sites (Prague), each with 18 cells of which one per RAT is
 * kept. Cells sit at the site's own coordinates, which is what puts these sites
 * in the SITE_CELLS layer when their cells are present.
 */
const SITES = [
  {
    physicalLocationId: 'Janackovo_nabrezi',
    siteName: 'Janackovo_nabrezi',
    insertType: 'Outdoor',
    street1: '',
    city: '',
    postalCode: '',
    country: 'Czech Republic',
    region: '',
    longitude: 14.408461,
    latitude: 50.076382,
    managedByTNAP: false,
    cellCount: 18,
    cells: [
      {
        cellId: 'service_Janackovo_nabrezi1-BTS-CELL-02',
        cellName: 'service_Janackovo_nabrezi1-BTS-CELL-02',
        sitePhysicalLocationId: 'Janackovo_nabrezi',
        radioAccessTechnology: 'GSM',
        cellType: 'Outdoor',
        nodeId: 'service_Janackovo_nabrezi1-BTS',
        frequencyBand: '62',
        band: 'gsm_900',
        mcc: '230',
        mnc: '01',
        azimuth: 170,
        cellLocalId: 2,
        longitude: 14.408461,
        latitude: 50.07638,
      },
      {
        cellId: 'service_Janackovo_nabrezi1-eNodeB-CELL-06',
        cellName: 'service_Janackovo_nabrezi1-eNodeB-CELL-06',
        sitePhysicalLocationId: 'Janackovo_nabrezi',
        radioAccessTechnology: 'LTE',
        cellType: 'Outdoor',
        nodeId: 'service_Janackovo_nabrezi1-eNodeB',
        frequencyBand: '1300',
        band: 'b3',
        mcc: '230',
        mnc: '01',
        azimuth: 290,
        cellLocalId: 6,
        longitude: 14.408461,
        latitude: 50.07638,
      },
      {
        cellId: 'service_Janackovo_nabrezi1-gNodeB-CELL-11',
        cellName: 'service_Janackovo_nabrezi1-gNodeB-CELL-11',
        sitePhysicalLocationId: 'Janackovo_nabrezi',
        radioAccessTechnology: 'NR',
        cellType: 'Outdoor',
        nodeId: 'service_Janackovo_nabrezi1-gNodeB',
        frequencyBand: '632628',
        band: 'n78',
        mcc: '230',
        mnc: '01',
        azimuth: 50,
        cellLocalId: 11,
        longitude: 14.408461,
        latitude: 50.07638,
      },
    ],
  },
  {
    physicalLocationId: 'Strossmayerovo_namesti',
    siteName: 'Strossmayerovo_namesti',
    insertType: 'Outdoor',
    street1: '',
    city: '',
    postalCode: '',
    country: 'Czech Republic',
    region: '',
    longitude: 14.43053,
    latitude: 50.096176,
    managedByTNAP: false,
    cellCount: 18,
    cells: [
      {
        cellId: 'service_Strossmayerovo_namesti1-eNodeB-CELL-04',
        cellName: 'service_Strossmayerovo_namesti1-eNodeB-CELL-04',
        sitePhysicalLocationId: 'Strossmayerovo_namesti',
        radioAccessTechnology: 'LTE',
        cellType: 'Outdoor',
        nodeId: 'service_Strossmayerovo_namesti1-eNodeB',
        frequencyBand: '1300',
        band: 'b3',
        mcc: '230',
        mnc: '01',
        azimuth: 50,
        cellLocalId: 4,
        longitude: 14.43053,
        latitude: 50.096176,
      },
      {
        cellId: 'service_Strossmayerovo_namesti1-gNodeB-CELL-12',
        cellName: 'service_Strossmayerovo_namesti1-gNodeB-CELL-12',
        sitePhysicalLocationId: 'Strossmayerovo_namesti',
        radioAccessTechnology: 'NR',
        cellType: 'Outdoor',
        nodeId: 'service_Strossmayerovo_namesti1-gNodeB',
        frequencyBand: '632628',
        band: 'n78',
        mcc: '230',
        mnc: '01',
        azimuth: 170,
        cellLocalId: 12,
        longitude: 14.43053,
        latitude: 50.096176,
      },
      {
        cellId: 'service_Strossmayerovo_namesti1-BTS-CELL-01',
        cellName: 'service_Strossmayerovo_namesti1-BTS-CELL-01',
        sitePhysicalLocationId: 'Strossmayerovo_namesti',
        radioAccessTechnology: 'GSM',
        cellType: 'Outdoor',
        nodeId: 'service_Strossmayerovo_namesti1-BTS',
        frequencyBand: '62',
        band: 'gsm_900',
        mcc: '230',
        mnc: '01',
        azimuth: 50,
        cellLocalId: 1,
        longitude: 14.43053,
        latitude: 50.096176,
      },
    ],
  },
  {
    physicalLocationId: 'Belgicka',
    siteName: 'Belgicka',
    insertType: 'Outdoor',
    street1: '',
    city: '',
    postalCode: '',
    country: 'Czech Republic',
    region: '',
    longitude: 14.437439,
    latitude: 50.073639,
    managedByTNAP: false,
    cellCount: 18,
    cells: [
      {
        cellId: 'service_Belgicka1-gNodeB-CELL-10',
        cellName: 'service_Belgicka1-gNodeB-CELL-10',
        sitePhysicalLocationId: 'Belgicka',
        radioAccessTechnology: 'NR',
        cellType: 'Outdoor',
        nodeId: 'service_Belgicka1-gNodeB',
        frequencyBand: '632628',
        band: 'n78',
        mcc: '230',
        mnc: '01',
        azimuth: 290,
        cellLocalId: 10,
        longitude: 14.437439,
        latitude: 50.073639,
      },
      {
        cellId: 'service_Belgicka1-eNodeB-CELL-05',
        cellName: 'service_Belgicka1-eNodeB-CELL-05',
        sitePhysicalLocationId: 'Belgicka',
        radioAccessTechnology: 'LTE',
        cellType: 'Outdoor',
        nodeId: 'service_Belgicka1-eNodeB',
        frequencyBand: '1300',
        band: 'b3',
        mcc: '230',
        mnc: '01',
        azimuth: 170,
        cellLocalId: 5,
        longitude: 14.437439,
        latitude: 50.073639,
      },
      {
        cellId: 'service_Belgicka1-BTS-CELL-03',
        cellName: 'service_Belgicka1-BTS-CELL-03',
        sitePhysicalLocationId: 'Belgicka',
        radioAccessTechnology: 'GSM',
        cellType: 'Outdoor',
        nodeId: 'service_Belgicka1-BTS',
        frequencyBand: '62',
        band: 'gsm_900',
        mcc: '230',
        mnc: '01',
        azimuth: 290,
        cellLocalId: 3,
        longitude: 14.437439,
        latitude: 50.073639,
      },
    ],
  },
];

interface AreaCall {
  /** The raw `sitesOnly` query value, `null` when the parameter was omitted. */
  sitesOnly: string | null;
  zoomHint: string | null;
}

interface AreaStub {
  calls: AreaCall[];
  tiles: { count: number };
  /** `physicalLocationId` of each /cell-sites lookup the detail pane made. */
  siteLookups: (string | null)[];
}

/**
 * Fulfills /api/cell-sites/area the way portal-cell-sites does: with
 * `sitesOnly=true` every site keeps its `cellCount` but ships an empty `cells`
 * array. Records each call so a test can assert the parameter the app sent.
 */
async function stubArea(page: Page): Promise<AreaStub> {
  const stub: AreaStub = {
    calls: [],
    tiles: await stubTiles(page),
    siteLookups: [],
  };

  // The single-site lookup the detail pane uses to recover the cells the map
  // deliberately did not fetch.
  await page.route(SITE_BY_ID_URL, async route => {
    const url = new URL(route.request().url());
    const requested = url.searchParams.get('physicalLocationId');
    stub.siteLookups.push(requested);

    // Substring + siteName matching, like portal-cell-sites: the exact site is
    // not necessarily the first entry.
    const matches = SITES.filter(
      site =>
        requested !== null &&
        site.physicalLocationId.toLowerCase().includes(requested.toLowerCase())
    );
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cellSites: matches, totalCount: matches.length }),
    });
  });

  await page.route('**/api/cell-sites/area*', async route => {
    const url = new URL(route.request().url());
    const sitesOnly = url.searchParams.get('sitesOnly');
    stub.calls.push({ sitesOnly, zoomHint: url.searchParams.get('minLat') });

    const withheld = sitesOnly === 'true';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        cellSites: SITES.map(site => ({
          ...site,
          cells: withheld ? [] : site.cells,
        })),
      }),
    });
  });

  return stub;
}

/** Fill colours of the site markers currently drawn in the overlay pane. */
async function overlayFillColors(page: Page): Promise<string[]> {
  return page
    .locator(OVERLAY_PATHS)
    .evaluateAll(paths =>
      paths.map(path => (path as SVGPathElement).getAttribute('fill') ?? '')
    );
}

test.use({ locale: 'en' });

test.describe('Cell Site Map - sites-only requests below the cell render zoom', () => {
  test('asks for sites only at the zoom the map opens on', async ({ page }) => {
    const stub = await stubArea(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();

    await expect
      .poll(() => stub.calls.length, { timeout: 15000 })
      .toBeGreaterThan(0);

    // The parameter has to be on the wire, not merely computed: it is what turns
    // a 1.4 MB response into 36 KB on do4. Every call at this zoom must carry it
    // — a single omission re-fetches the cells the map cannot draw.
    expect(stub.calls.map(call => call.sitesOnly)).not.toContain(null);
    expect(new Set(stub.calls.map(call => call.sitesOnly))).toEqual(
      new Set(['true'])
    );
  });

  test('still draws every site when its cells are withheld', async ({
    page,
  }) => {
    const stub = await stubArea(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect
      .poll(() => stub.calls.length, { timeout: 15000 })
      .toBeGreaterThan(0);

    // One marker per site. Asserting the count is what catches the failure mode
    // where neither classification predicate matches: createMarkers then emits
    // nothing and the sites vanish from the map without any error.
    const paths = page.locator(OVERLAY_PATHS);
    await expect
      .poll(() => paths.count(), { timeout: 15000 })
      .toBeGreaterThanOrEqual(SITES.length);

    // …and they are drawn as SITE_CELLS (black), not reclassified into SITE_ONLY
    // (grey). `cells: []` makes the SITE_ONLY predicate's `[].every(...)`
    // vacuously true, so without the cellCount guard the whole map silently
    // changes shape and colour at its default zoom.
    const fills = await overlayFillColors(page);
    expect(fills).toContain(SITE_CELLS_COLOR);
    expect(fills).not.toContain(SITE_ONLY_COLOR);

    // The tile stub really matched, so nothing reached tile.openstreetmap.org.
    expect(stub.tiles.count).toBeGreaterThan(0);
  });

  test('site list reports the real cell count of a withheld site', async ({
    page,
  }) => {
    const stub = await stubArea(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect
      .poll(() => stub.calls.length, { timeout: 15000 })
      .toBeGreaterThan(0);

    await page.locator('.qa_map_sidebar_site_list').click();
    await expect(page.locator('.qa_site_list_table')).toBeVisible();

    // Every site is listed, with the name coming from the response body rather
    // than from page chrome.
    await expect(page.locator('.qa_site_list_open_detail')).toHaveCount(
      SITES.length
    );
    const row = page.getByRole('row', { name: /Janackovo_nabrezi/ });
    await expect(row).toBeVisible();

    // 18, not 0: the cells are withheld but cellCount is not. Reading
    // cells.length here showed 0 for every site at the map's default zoom.
    await expect(
      row.getByRole('cell', { name: '18', exact: true })
    ).toBeVisible();
  });

  // The map deliberately stops fetching cells below the threshold, but the detail
  // pane's whole purpose is to list them — so it fetches them for the one site it
  // shows. Without this the pane's cell table is empty at the default zoom.
  test('detail pane fetches the cells of the site it opens', async ({
    page,
  }) => {
    const stub = await stubArea(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect
      .poll(() => stub.calls.length, { timeout: 15000 })
      .toBeGreaterThan(0);

    await page.locator('.qa_map_sidebar_site_list').click();
    await expect(page.locator('.qa_site_list_table')).toBeVisible();

    const row = page.getByRole('row', { name: /Janackovo_nabrezi/ });
    await row.locator('.qa_site_list_open_detail').click();

    const pane = page.locator('.qa_site_pane');
    await expect(pane).toBeVisible();
    await expect(pane.locator('.qa_site_title')).toHaveText(
      'Janackovo_nabrezi'
    );

    // It asked for exactly the site it opened…
    await expect
      .poll(() => stub.siteLookups, { timeout: 15000 })
      .toContain('Janackovo_nabrezi');

    // …and the cells are on screen. Asserting the rows, not the request: the
    // request firing with the right id proves nothing about the rendered table,
    // which is the part that was empty.
    const cellRows = pane.locator('.qa_cell_table tbody tr:not(.loading-row)');
    await expect(cellRows).toHaveCount(3);
    await expect(
      pane.getByRole('cell', {
        name: 'service_Janackovo_nabrezi1-eNodeB-CELL-06',
      })
    ).toBeVisible();
  });

  // The lookup parameter is a substring match against physicalLocationId OR
  // siteName on the backend, so a page-size-1 request can answer with a
  // different site whose id merely contains this one.
  test('detail pane shows the exactly matching site, not a longer id', async ({
    page,
  }) => {
    const stub = await stubArea(page);

    // Two sites whose ids both contain the shorter one, the longer sorting first.
    await page.unroute(SITE_BY_ID_URL);
    await page.route(SITE_BY_ID_URL, async route => {
      const requested = new URL(route.request().url()).searchParams.get(
        'physicalLocationId'
      );
      stub.siteLookups.push(requested);
      const exact = SITES[0];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          cellSites: [
            {
              ...exact,
              physicalLocationId: `${exact.physicalLocationId}_2`,
              siteName: `${exact.siteName}_2`,
              cellCount: 1,
              cells: [{ ...exact.cells[0], cellId: 'WRONG-SITE-CELL' }],
            },
            exact,
          ],
          totalCount: 2,
        }),
      });
    });

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect
      .poll(() => stub.calls.length, { timeout: 15000 })
      .toBeGreaterThan(0);

    await page.locator('.qa_map_sidebar_site_list').click();
    await expect(page.locator('.qa_site_list_table')).toBeVisible();
    await page
      .getByRole('row', { name: /Janackovo_nabrezi/ })
      .locator('.qa_site_list_open_detail')
      .click();

    const pane = page.locator('.qa_site_pane');
    await expect(pane).toBeVisible();

    const cellRows = pane.locator('.qa_cell_table tbody tr:not(.loading-row)');
    await expect(cellRows).toHaveCount(3);
    await expect(
      pane.getByRole('cell', { name: 'WRONG-SITE-CELL' })
    ).toBeHidden();
  });
});
