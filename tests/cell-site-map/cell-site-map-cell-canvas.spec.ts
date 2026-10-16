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
import { installMapCapture, SITE_BY_ID_URL, stubTiles } from './map-test-utils';

/**
 * Cell coverage wedges are drawn into a single shared <canvas> instead of one SVG
 * <path> each: a dense do4 viewport carries ~5800 of them and the per-element DOM
 * churn, not the geometry, dominated the map's load time (~2.1 s → ~0.4 s of main
 * thread work).
 *
 * The saving is real but it moves the wedges out of the DOM, and with them every
 * piece of interaction the browser used to provide for free. Leaflet's canvas
 * renderer re-implements hit-testing itself, by walking its layer list and calling
 * `_containsPoint` on synthesized mousemove/click events — so hovering a wedge for
 * its tooltip and clicking it to open its site are exactly the behaviours that can
 * regress silently. Neither is covered by a unit test, because both depend on the
 * renderer, the map panes and the real pointer.
 *
 * Hence this spec asserts, through the pointer:
 *  - the wedges really are on a canvas (and the site markers really are not, so
 *    site clicks keep winning where the two overlap),
 *  - hovering one opens its tooltip with that cell's data,
 *  - clicking one selects the cell and opens its site's detail pane.
 *
 * Because a canvas wedge has no DOM node, nothing here may assert on a `path`
 * locator for a cell — the assertions are the tooltip, the URL and the pane. That
 * is also why this cannot be a unit test: it is the rendered, pointer-driven path.
 */

/** The map opens at this zoom; cells render only from CELLS_ZOOM_DISPLAY_THRESHOLD. */
const CELL_RENDER_ZOOM = 14;

const SITE_ID = 'Janackovo_nabrezi';
const SITE_LAT = 50.076382;
const SITE_LON = 14.408461;

/**
 * One real do4 site with a single GSM cell.
 *
 * The frequency is load-bearing, not decoration: `doCellFiltering` only shows a
 * cell whose RAT **and** band **and** frequency all appear in the
 * /api/cell-sites/filters response, and `buildFilterControl` derives the wedge
 * radius from that same list. FILTERS below stubs it, so this pairing is defined
 * here rather than inherited from the shared WireMock stub.
 *
 * A single cell on purpose: with the site marker drawn on top of the wedge's tip,
 * one wedge means one unambiguous target, and its 40° opening (LAYER_ATTRIBUTES)
 * is what CELL_BEARING below aims into.
 */
const CELL = {
  cellId: 'service_Janackovo_nabrezi1-BTS-CELL-02',
  cellName: 'service_Janackovo_nabrezi1-BTS-CELL-02',
  sitePhysicalLocationId: SITE_ID,
  radioAccessTechnology: 'GSM',
  cellType: 'Outdoor',
  nodeId: 'service_Janackovo_nabrezi1-BTS',
  frequencyBand: '62',
  band: 'gsm_900',
  mcc: '230',
  mnc: '01',
  azimuth: 0,
  cellLocalId: 2,
  longitude: SITE_LON,
  latitude: SITE_LAT,
};

const SITE = {
  physicalLocationId: SITE_ID,
  siteName: SITE_ID,
  insertType: 'Outdoor',
  street1: '',
  city: '',
  postalCode: '',
  country: 'Czech Republic',
  region: '',
  longitude: SITE_LON,
  latitude: SITE_LAT,
  managedByTNAP: false,
  cellCount: 1,
  cells: [CELL],
};

/**
 * The cell filter values, stubbed rather than taken from the shared WireMock
 * mapping, because two things the pointer needs depend on them:
 *
 *  - `doCellFiltering` only adds a wedge to the visible layer when the cell's RAT,
 *    band and frequency all appear here, and
 *  - `buildFilterControl` sizes every wedge from this list —
 *    `CELL_DISTANCE_MAX / uniqueFrequencies × descendingRank`.
 *
 * With this cell's frequency as the only one, that resolves to the full
 * CELL_DISTANCE_MAX of 250 m, so CELL_HIT_DISTANCE below has generous margin. On
 * the shared stub the same pairing is one of 23 frequencies and would yield ~217 m
 * — fine today, but a wedge whose radius is set by a fixture this spec does not
 * control shrinks or vanishes when that fixture changes, and all three tests then
 * fail as unexplained hover/`toHaveCount` timeouts.
 */
const FILTERS = {
  rats: [
    {
      id: 'gsm',
      rat: 'gsm',
      bands: [
        {
          id: `gsm-${CELL.band}`,
          band: CELL.band,
          frequencies: [
            {
              id: `gsm-${CELL.band}-${CELL.frequencyBand}`,
              frequency: CELL.frequencyBand,
            },
          ],
        },
      ],
    },
  ],
};

interface MapStub {
  area: number;
  /** `physicalLocationId` of each /cell-sites lookup the detail pane made. */
  siteLookups: (string | null)[];
}

/**
 * Serves the base map, the filter values, the viewport and the single-site lookup
 * locally, honouring `sitesOnly` the way portal-cell-sites does (cells withheld,
 * `cellCount` kept).
 */
async function stubMap(page: Page): Promise<MapStub> {
  const stub: MapStub = { area: 0, siteLookups: [] };

  // The tile count is not asserted here — this spec drives the pointer, not the
  // base map — but the stub still has to be installed, or every pan/zoom below
  // reaches tile.openstreetmap.org for real.
  await stubTiles(page);

  await page.route('**/api/cell-sites/filters*', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(FILTERS),
    });
  });

  await page.route('**/api/cell-sites/area*', async route => {
    stub.area += 1;
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
    const requested = new URL(route.request().url()).searchParams.get(
      'physicalLocationId'
    );
    stub.siteLookups.push(requested);
    const matches =
      requested !== null &&
      SITE.physicalLocationId.toLowerCase().includes(requested.toLowerCase())
        ? [SITE]
        : [];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cellSites: matches, totalCount: matches.length }),
    });
  });

  // Reached via the cell id the wedge click puts in the URL; it is how the map
  // resolves a selected cell back to its site.
  await page.route(`**/api/cell-sites/cells/${CELL.cellId}`, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(CELL),
    });
  });

  return stub;
}

/** The bits of the captured Leaflet map instance this spec drives. */
interface E2eMap {
  setView: (center: [number, number], zoom: number) => void;
  latLngToContainerPoint: (latLng: [number, number]) => {
    x: number;
    y: number;
  };
}

/**
 * Zoom to where cells render and centre on the site, then wait for the viewport
 * response that carries the cells.
 *
 * Below CELLS_ZOOM_DISPLAY_THRESHOLD the filteredCells layer group is not on the
 * map at all and /area is asked for `sitesOnly=true`, so a spec that skips this
 * finds no wedge to hover and no cell to click — and would pass the "no canvas"
 * assertion for the wrong reason.
 */
async function zoomToCells(page: Page, stub: MapStub) {
  const before = stub.area;
  await page.evaluate(
    ([lat, lon, zoom]) => {
      const map = (window as unknown as { __e2eMap?: E2eMap }).__e2eMap;
      if (!map) throw new Error('Leaflet map instance not captured');
      map.setView([lat, lon], zoom);
    },
    [SITE_LAT, SITE_LON, CELL_RENDER_ZOOM]
  );
  await expect
    .poll(() => stub.area, { timeout: 15000 })
    .toBeGreaterThan(before);
}

/**
 * Container pixel a given distance/bearing away from the cell, i.e. a point
 * inside its wedge.
 *
 * Computed from the map rather than hardcoded because the pixel depends on the
 * container size, and offset from the cell rather than aimed at its centre
 * because the site marker is drawn on top of the wedge's tip — on the SVG pane,
 * which sits ABOVE the canvas (leaflet.css: canvas z-index 100, svg 200). Aiming
 * at the centre would hit the marker and prove nothing about the canvas.
 */
async function wedgePoint(
  page: Page,
  metres: number,
  bearingDeg: number
): Promise<{ x: number; y: number }> {
  return page.evaluate(
    ([lat, lon, metres, bearingDeg]) => {
      const map = (window as unknown as { __e2eMap?: E2eMap }).__e2eMap;
      if (!map) throw new Error('Leaflet map instance not captured');
      // Local flat-earth offset: at these distances (≲250 m) the error is far
      // below a pixel, and it keeps the geodesy library out of the browser
      // context.
      const rad = (bearingDeg * Math.PI) / 180;
      const dLat = (metres * Math.cos(rad)) / 111_320;
      const dLon =
        (metres * Math.sin(rad)) / (111_320 * Math.cos((lat * Math.PI) / 180));
      return map.latLngToContainerPoint([lat + dLat, lon + dLon]);
    },
    [SITE_LAT, SITE_LON, metres, bearingDeg]
  );
}

/**
 * Move the pointer onto a canvas wedge.
 *
 * Two moves, not one: Leaflet's canvas renderer throttles its synthetic hover
 * handling with a 32 ms timer (`_mouseHoverThrottled`), so a single move can be
 * swallowed entirely and the tooltip never opens. The bounding box is offset by
 * the map container's own position on the page.
 */
async function hoverWedge(page: Page, point: { x: number; y: number }) {
  const box = await page.locator('#map').boundingBox();
  if (!box) throw new Error('map container has no bounding box');
  const x = box.x + point.x;
  const y = box.y + point.y;
  await page.mouse.move(x, y);
  await page.mouse.move(x + 1, y + 1);
  return { x: x + 1, y: y + 1 };
}

// The wedge opens 40° around azimuth 0 (LAYER_ATTRIBUTES[GSM]) and reaches the
// full CELL_DISTANCE_MAX of 250 m (its frequency is the only one in FILTERS). Aim
// well inside both: under half the radius, and the azimuth itself.
const CELL_BEARING = 0;
const CELL_HIT_DISTANCE = 110;

// playwright.config.ts already pins locale: 'en' for every project; repeated here
// like the other cell-site-map specs so the tooltip assertions below do not depend
// on that global staying put.
test.use({ locale: 'en' });

test.describe('Cell Site Map - canvas-rendered cell coverage', () => {
  test('draws the cell coverage on a canvas while site markers stay SVG', async ({
    page,
  }) => {
    const stub = await stubMap(page);
    await installMapCapture(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect.poll(() => stub.area, { timeout: 15000 }).toBeGreaterThan(0);

    // At the opening zoom no cell is on the map, so no cell canvas exists yet.
    // Asserting this first is what makes the post-zoom assertion meaningful:
    // otherwise a canvas from any other source would satisfy it.
    await expect(page.locator('.leaflet-overlay-pane canvas')).toHaveCount(0);

    await zoomToCells(page, stub);

    // The wedges share one canvas — one element for all of them, which is the
    // whole point of the change.
    await expect(page.locator('.leaflet-overlay-pane canvas')).toHaveCount(1);

    // …and the site markers did NOT move to it. They must stay SVG: their
    // per-marker setStyle selection highlight, the geoman controls and the
    // existing specs' `path` locators all depend on the DOM element, and the SVG
    // pane's higher z-index is what keeps a site click winning over the wedge
    // beneath it.
    await expect
      .poll(() => page.locator('.leaflet-overlay-pane path').count(), {
        timeout: 15000,
      })
      .toBeGreaterThan(0);
  });

  test('shows the cell tooltip when hovering its coverage on the canvas', async ({
    page,
  }) => {
    const stub = await stubMap(page);
    await installMapCapture(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect.poll(() => stub.area, { timeout: 15000 }).toBeGreaterThan(0);
    await zoomToCells(page, stub);
    await expect(page.locator('.leaflet-overlay-pane canvas')).toHaveCount(1);

    await hoverWedge(
      page,
      await wedgePoint(page, CELL_HIT_DISTANCE, CELL_BEARING)
    );

    // The tooltip is the only observable proof that the canvas hit-test found the
    // wedge: with the wedges out of the DOM, Leaflet's own `_containsPoint` walk
    // over its layer list is all that stands between a hover and nothing at all.
    const tooltip = page.locator('.cell-coverage-tooltip');
    await expect(tooltip).toBeVisible();

    // And it is THIS cell's tooltip, not merely some tooltip — a hit-test that
    // resolved to the wrong layer would still show one.
    await expect(tooltip).toContainText(CELL.cellName);
    await expect(tooltip).toContainText('GSM');
    await expect(tooltip).toContainText(CELL.band);
    await expect(tooltip).toContainText(CELL.frequencyBand);
  });

  test('selects the cell and opens its site when its coverage is clicked', async ({
    page,
  }) => {
    const stub = await stubMap(page);
    await installMapCapture(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect.poll(() => stub.area, { timeout: 15000 }).toBeGreaterThan(0);
    await zoomToCells(page, stub);
    await expect(page.locator('.leaflet-overlay-pane canvas')).toHaveCount(1);

    // Hovering first mirrors a real pointer and settles the canvas hit-test the
    // click then repeats; `.leaflet-tooltip` is pointer-events: none, so the
    // tooltip it opens cannot intercept the click.
    const target = await hoverWedge(
      page,
      await wedgePoint(page, CELL_HIT_DISTANCE, CELL_BEARING)
    );
    await page.mouse.click(target.x, target.y);

    // The wedge's click handler routes to the map with the cell selected, which
    // is what the whole interaction exists for.
    await expect(page).toHaveURL(
      new RegExp(`cellId=${encodeURIComponent(CELL.cellId)}`)
    );

    // …and the selection is followed through: the cell id is resolved to its site
    // and that site's detail pane opens. Asserting the rendered pane, not just
    // the URL — a canvas click that fired on the wrong layer, or on none, would
    // leave the pane closed.
    const pane = page.locator('.qa_site_pane');
    await expect(pane).toBeVisible();
    await expect(pane.locator('.qa_site_title')).toHaveText(SITE_ID);
    await expect
      .poll(() => stub.siteLookups, { timeout: 15000 })
      .toContain(SITE_ID);
  });
});
