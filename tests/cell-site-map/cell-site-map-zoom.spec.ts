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
 * Zoom behaviour of the Cell Site Map, which only exists in the rendered map:
 *
 *  - opening a site detail uses the same detail zoom as selecting a cell, and
 *  - a zoom the user already chose closer than that is left alone, and
 *  - the zoom buttons report the reached limit instead of silently doing nothing.
 *
 * None of the three can be covered by a unit test: they depend on the real
 * Leaflet zoom range (which comes from the tile layer) and on the marker click
 * that puts the site into the URL.
 */

/** CELL_ZOOM_HIGHTLIGHTED — the zoom a selected site or cell is shown at. */
const DETAIL_ZOOM = 16;

/** A zoom closer than DETAIL_ZOOM, to prove the detail never zooms back out. */
const CLOSER_THAN_DETAIL_ZOOM = 17;

const SITE_ID = 'Janackovo_nabrezi';
const SITE_LAT = 50.076382;
const SITE_LON = 14.408461;

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
  cells: [
    {
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
    },
  ],
};

/** Site markers are SVG; cell coverage shares a canvas in the same pane. */
const SITE_MARKER = '.leaflet-overlay-pane path';

interface AreaStub {
  count: number;
}

async function stubMap(page: Page): Promise<AreaStub> {
  const stub: AreaStub = { count: 0 };

  await stubTiles(page);

  await page.route('**/api/cell-sites/area*', async route => {
    stub.count += 1;
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

  return stub;
}

/** The bits of the captured Leaflet map instance this spec drives. */
interface E2eMap {
  getZoom: () => number;
  getMinZoom: () => number;
  getMaxZoom: () => number;
  setView: (center: [number, number], zoom: number) => void;
  setZoom: (zoom: number) => void;
}

/** Reads the current Leaflet zoom from the captured map instance. */
function currentZoom(page: Page): Promise<number> {
  return page.evaluate(() => {
    const map = (window as unknown as { __e2eMap?: E2eMap }).__e2eMap;
    if (!map) throw new Error('Leaflet map instance not captured');
    return map.getZoom();
  });
}

/** Drives the map to one end of its zoom range, as the wheel or a key would. */
function zoomToLimit(page: Page, limit: 'min' | 'max'): Promise<void> {
  return page.evaluate(which => {
    const map = (window as unknown as { __e2eMap?: E2eMap }).__e2eMap;
    if (!map) throw new Error('Leaflet map instance not captured');
    map.setZoom(which === 'max' ? map.getMaxZoom() : map.getMinZoom());
  }, limit);
}

async function openMap(page: Page): Promise<AreaStub> {
  const stub = await stubMap(page);
  await installMapCapture(page);

  await page.goto('/cell-site-map');
  await expect(page.locator('.leaflet-container')).toBeVisible();
  await expect.poll(() => stub.count, { timeout: 15000 }).toBeGreaterThan(0);

  return stub;
}

/** Moves the map and waits for the viewport response that redraws the markers. */
async function viewAt(page: Page, stub: AreaStub, zoom: number) {
  const before = stub.count;
  await page.evaluate(
    ([lat, lon, level]) => {
      const map = (window as unknown as { __e2eMap?: E2eMap }).__e2eMap;
      if (!map) throw new Error('Leaflet map instance not captured');
      map.setView([lat, lon], level);
    },
    [SITE_LAT, SITE_LON, zoom]
  );
  await expect
    .poll(() => stub.count, { timeout: 15000 })
    .toBeGreaterThan(before);
}

// playwright.config.ts already pins locale: 'en'; repeated like the other
// cell-site-map specs so this spec does not depend on that global staying put.
test.use({ locale: 'en' });

test.describe('Cell Site Map - zoom', () => {
  test('opens a site detail at the detail zoom level', async ({ page }) => {
    await openMap(page);

    await expect(page.locator(SITE_MARKER).first()).toBeVisible();
    await page.locator(SITE_MARKER).first().dispatchEvent('click');

    await expect
      .poll(() => currentZoom(page), { timeout: 15000 })
      .toBe(DETAIL_ZOOM);
  });

  test('keeps a zoom level that is already closer than the detail zoom', async ({
    page,
  }) => {
    const stub = await openMap(page);
    await viewAt(page, stub, CLOSER_THAN_DETAIL_ZOOM);

    await expect(page.locator(SITE_MARKER).first()).toBeVisible();
    await page.locator(SITE_MARKER).first().dispatchEvent('click');

    // Give the detail centring (a delayed setView) time to run, then assert it
    // did not pull the map back out to DETAIL_ZOOM.
    await expect
      .poll(() => currentZoom(page), { timeout: 15000 })
      .toBe(CLOSER_THAN_DETAIL_ZOOM);
  });

  test('marks the zoom buttons as disabled at the zoom limits', async ({
    page,
  }) => {
    await openMap(page);

    const zoomIn = page.locator('.qa_btn_map_zoom_in');
    const zoomOut = page.locator('.qa_btn_map_zoom_out');

    await expect(zoomIn).toHaveAttribute('aria-disabled', 'false');
    await expect(zoomOut).toHaveAttribute('aria-disabled', 'false');

    await zoomToLimit(page, 'max');
    await expect(zoomIn).toHaveAttribute('aria-disabled', 'true');
    await expect(zoomOut).toHaveAttribute('aria-disabled', 'false');

    await zoomToLimit(page, 'min');
    await expect(zoomOut).toHaveAttribute('aria-disabled', 'true');
    await expect(zoomIn).toHaveAttribute('aria-disabled', 'false');
  });
});
