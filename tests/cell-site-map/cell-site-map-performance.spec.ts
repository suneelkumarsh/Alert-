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
import { installMapCapture, stubTiles, TILE_URL } from './map-test-utils';

/**
 * Performance regression guards for the Cell Site Map.
 *
 * The map re-fetches cell-site data on every map move (moveend → the
 * /api/cell-sites/area call). Several overlay layers were wired to rebuild
 * themselves on that same signal, and the slice layer re-issued a backend
 * request per slice on every pan:
 *
 *  - the slice layer fetched one /api/network/slices/{id} detail per slice on
 *    every pan (an N+1 that scaled with slice count × pans), and it re-added
 *    slice polygons without clearing the previous ones (duplicates).
 *
 * These tests stub the map backend deterministically, drive map pans via
 * Leaflet's panBy (each gated on its viewport fetch), and assert the per-slice
 * detail calls do NOT multiply across pans. They fail against the pre-fix
 * behaviour (detail calls grow with every pan) and pass once slice details are
 * cached and the slice layer is cleared before re-adding.
 *
 * The base map tiles are stubbed too, so the suite performs no third-party
 * requests at all — see stubTiles in map-test-utils.
 */

const SLICE_A = '0377b1fc-4d2b-4db6-87bd-5a60fc103530';
const SLICE_B = '11111111-2222-3333-4444-555555555555';

function sliceDetail(id: string) {
  return {
    id,
    name: `slice-${id.slice(0, 4)}`,
    serviceType: 'eMBB',
    operationalStatus: 'active',
    environmentContext: 'test',
    orchestrationStatus: 'active',
    cells: [
      { cellId: `${id}-c1`, latitude: 48.1355, longitude: 11.5825 },
      { cellId: `${id}-c2`, latitude: 48.1349, longitude: 11.5815 },
    ],
    sliceProfile: { profileId: `profile-${id.slice(0, 4)}` },
  };
}

interface BackendCounts {
  area: number;
  slicesInMap: number;
  sliceDetail: Map<string, number>;
  tiles: { count: number };
}

/** Deterministic map backend + per-endpoint call counters. */
async function stubMapBackend(page: Page): Promise<BackendCounts> {
  const counts: BackendCounts = {
    area: 0,
    slicesInMap: 0,
    sliceDetail: new Map<string, number>(),
    tiles: await stubTiles(page),
  };

  // Slices shown on the map: /api/network/slices/cells (listSlicesInMap).
  // Playwright evaluates routes in reverse registration order (last-registered
  // wins), so this specific route is registered BEFORE the broader `slices/*`
  // route below; the broad route also guards `id === 'cells'` and falls back,
  // so this handler serves the slices-in-map list regardless of ordering.
  await page.route('**/api/network/slices/cells*', async route => {
    counts.slicesInMap += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        items: [sliceDetail(SLICE_A), sliceDetail(SLICE_B)],
      }),
    });
  });

  // Slice detail: /api/network/slices/{id}  (the N+1 we are guarding).
  await page.route('**/api/network/slices/*', async route => {
    const url = route.request().url();
    const match = url.match(/\/api\/network\/slices\/([^/?]+)(?:\?|$)/);
    const id = match?.[1];
    if (!id || id === 'cells') {
      await route.fallback();
      return;
    }
    counts.sliceDetail.set(id, (counts.sliceDetail.get(id) ?? 0) + 1);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sliceDetail(id)),
    });
  });

  // Cell sites in the current viewport: /api/cell-sites/area (fires per moveend).
  await page.route('**/api/cell-sites/area*', async route => {
    counts.area += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ cellSites: [] }),
    });
  });

  return counts;
}

/**
 * Pan the map deterministically via Leaflet's panBy and resolve once the
 * viewport fetch (counts.area) for that move has landed, so callers never race
 * a moveend that may not have fired.
 */
async function panMap(
  page: Page,
  counts: BackendCounts,
  dx: number,
  dy: number
) {
  const areaBefore = counts.area;
  await page.evaluate(
    ([dx, dy]) => {
      const map = (
        window as unknown as {
          __e2eMap?: { panBy: (o: [number, number], opts: object) => void };
        }
      ).__e2eMap;
      if (!map) throw new Error('Leaflet map instance not captured');
      map.panBy([dx, dy], { animate: false });
    },
    [dx, dy]
  );
  await expect
    .poll(() => counts.area, { timeout: 10000 })
    .toBeGreaterThan(areaBefore);
}

test.describe('Cell Site Map - performance regression guards', () => {
  test('map loads and fetches cell-site data on open', async ({ page }) => {
    const counts = await stubMapBackend(page);

    // Every tile request the page makes, whether or not the route matched it.
    const tileRequests: string[] = [];
    page.on('request', request => {
      if (TILE_URL.test(request.url())) tileRequests.push(request.url());
    });

    await page.goto('/cell-site-map');

    await expect(page.locator('#map')).toBeVisible();
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // The viewport data call fired at least once on initial load.
    await expect.poll(() => counts.area, { timeout: 15000 }).toBeGreaterThan(0);

    // Leaflet requested a tile grid for the initial viewport. Asserting > 0 is
    // what separates "the tile stub matched" from "the map never asked for a
    // tile" — a stub matching nothing would otherwise look like a passing test.
    await expect
      .poll(() => counts.tiles.count, { timeout: 15000 })
      .toBeGreaterThan(0);

    // …and every one of those requests was answered locally, so none reached the
    // real host — including the a./b./c. subdomains Leaflet expands {s} into.
    expect(counts.tiles.count).toBe(tileRequests.length);
  });

  test('panning does not re-issue per-slice detail requests (N+1 guard)', async ({
    page,
  }) => {
    const counts = await stubMapBackend(page);
    await installMapCapture(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // The slice layer loads one detail per slice on first render; the stub serves
    // two slices, so wait until both details have been fetched and settled.
    await expect
      .poll(() => counts.sliceDetail.size, { timeout: 15000 })
      .toBe(2);
    const idsAfterLoad = counts.sliceDetail.size;

    // Pan several times; each pan re-emits the slice layer's data source. panMap
    // resolves only once the pan's viewport fetch has landed.
    for (let i = 0; i < 3; i++) {
      await panMap(page, counts, 60, 40);
    }

    // Negative assertion: we assert an (unwanted) slice refetch did NOT happen.
    // There is no positive event to await for a non-occurrence, but each pan
    // above already awaited its counts.area increment — i.e. the moveend that
    // would trigger a slice refetch has been fully processed — so any regression
    // refetch has already been counted. A short settle covers the slice-detail
    // XHR landing just after the area call.
    // eslint-disable-next-line playwright/no-wait-for-timeout -- see above: a non-occurrence has no event to await
    await page.waitForTimeout(300);

    // Each slice id must have been fetched exactly once in total — panning must
    // not multiply the per-slice detail calls (the N+1 that this fix removes).
    for (const [id, count] of counts.sliceDetail) {
      expect(count, `slice ${id} detail fetched ${count}× (expected 1)`).toBe(
        1
      );
    }
    // The set of fetched ids did not grow with pans.
    expect(counts.sliceDetail.size).toBe(idsAfterLoad);
  });

  /*
   * Opening or closing a side panel resizes the map container. The component
   * answers that with LeafletMapService.invalidateSize(), and Leaflet's
   * invalidateSize() fires a synthetic `moveend` for the size change — which is
   * the same signal the viewport fetch is wired to. So every panel toggle used to
   * cost a full /cell-sites/area round trip (~1 s TTFB on do4) although the user
   * never moved the map.
   *
   * Both directions are wasted, in different ways, which is why each is asserted:
   * opening asks for a strict SUBSET of the loaded area (the map got narrower by
   * the panel width), closing asks for the exact bounds fetched before it. Verified
   * against the pre-fix build: initial load requested lon 11.48760…11.67656,
   * opening the panel 11.53360…11.63056, closing it 11.48760…11.67656 again.
   *
   * Asserting the request count is the whole point — the map looks identical
   * either way, so nothing else distinguishes a cached viewport from a refetched
   * one.
   */
  test('toggling a side panel does not refetch the viewport', async ({
    page,
  }) => {
    const counts = await stubMapBackend(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect.poll(() => counts.area, { timeout: 15000 }).toBeGreaterThan(0);

    const afterLoad = counts.area;

    await page.locator('.qa_map_sidebar_filters').click();
    // The panel being visible means the resize (and its moveend) has happened,
    // so a regression fetch would already be counted by the check below.
    await expect(page.locator('.qa_map_side_panel')).toBeVisible();
    // eslint-disable-next-line playwright/no-wait-for-timeout -- a non-occurrence has no event to await; the visible panel above proves the resize already ran
    await page.waitForTimeout(500);

    expect(
      counts.area,
      'opening the panel refetched the viewport it already had'
    ).toBe(afterLoad);

    await page.locator('.qa_map_side_panel_close').click();
    await expect(page.locator('.qa_map_side_panel')).toHaveCount(0);
    // eslint-disable-next-line playwright/no-wait-for-timeout -- see above
    await page.waitForTimeout(500);

    expect(
      counts.area,
      'closing the panel refetched the bounds it started from'
    ).toBe(afterLoad);
  });

  /*
   * The flip side of the guard above: it keys on the requested viewport, so a real
   * pan must still refetch. Without this, a bug that simply stopped refetching
   * would satisfy the test above and the map would silently never load new sites.
   */
  test('panning still refetches the viewport after a panel toggle', async ({
    page,
  }) => {
    const counts = await stubMapBackend(page);
    await installMapCapture(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect.poll(() => counts.area, { timeout: 15000 }).toBeGreaterThan(0);

    await page.locator('.qa_map_sidebar_filters').click();
    await expect(page.locator('.qa_map_side_panel')).toBeVisible();

    // panMap resolves only once the pan's own /area call has landed, so this
    // failing means the pan was skipped, not that it was merely slow.
    const beforePan = counts.area;
    await panMap(page, counts, 400, 300);

    expect(counts.area).toBeGreaterThan(beforePan);
  });

  /*
   * The guard's state lives in CellSiteDataService, which is providedIn:'root'
   * and so outlives the map component — but the Leaflet layer groups the
   * response fills are rebuilt empty every time that component is created.
   * Re-entering the map re-inits Leaflet at the configured center/zoom in an
   * equally sized container, so its first request repeats the bounds the previous
   * visit loaded; skipping it left the fresh layer groups empty and the map
   * without a single marker until the user panned.
   *
   * This has to navigate in-app: page.goto() reloads the whole app and rebuilds
   * the injector, which resets the root-scoped service and hides the bug
   * entirely. The side menu is collapsed, so its routerLink anchors are in the
   * DOM but not hit-testable — dispatching the click is still a real router
   * navigation, just not a synthetic user gesture.
   *
   * Site markers, not request counts, are the assertion: a re-entry that skips
   * the fetch is only a bug because nothing refills the layers, and the sites
   * come from the Wiremock stubs rather than an inline stub for that reason.
   */
  test('re-entering the map still renders its site markers', async ({
    page,
  }) => {
    let area = 0;
    await page.route('**/api/cell-sites/area*', async route => {
      area += 1;
      await route.fallback();
    });
    // Keep the base map local; this test does not use stubMapBackend because it
    // needs the stubbed sites to actually produce markers.
    await stubTiles(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect.poll(() => area, { timeout: 15000 }).toBeGreaterThan(0);
    const siteMarkers = page.locator('.leaflet-overlay-pane path');
    await expect
      .poll(() => siteMarkers.count(), { timeout: 15000 })
      .toBeGreaterThan(0);
    const markersOnFirstVisit = await siteMarkers.count();

    await page
      .locator('a[href="/slice-management/slice-list"]')
      .first()
      .dispatchEvent('click');
    await expect(page.locator('.leaflet-container')).toHaveCount(0);

    await page
      .locator('a[href="/cell-site-map"]')
      .first()
      .dispatchEvent('click');
    await expect(page.locator('.leaflet-container')).toBeVisible();

    await expect
      .poll(() => siteMarkers.count(), { timeout: 15000 })
      .toBe(markersOnFirstVisit);
  });

  test('slice polygons are not duplicated after panning', async ({ page }) => {
    const counts = await stubMapBackend(page);
    await installMapCapture(page);

    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();

    // Slice polygons render as SVG paths in the overlay pane.
    const paths = page.locator('.leaflet-overlay-pane path');
    await expect
      .poll(() => paths.count(), { timeout: 15000 })
      .toBeGreaterThan(0);
    const before = await paths.count();

    // Pan several times; panMap gates each pan on its viewport fetch
    // (counts.area increment) instead of an arbitrary sleep, so the moveend that
    // rebuilds the slice layer has been processed before the next pan.
    for (let i = 0; i < 3; i++) {
      await panMap(page, counts, 50, 30);
    }

    // The slice layer is cleared before re-adding, so the polygon count settles
    // to a bounded value instead of growing by `before` on every pan. Poll (not
    // a fixed sleep) so the layer redraw has time to settle. Generous headroom
    // (2×) absorbs cells/sites the pan brings into view; the pre-fix bug grew the
    // count without bound (before × pans).
    await expect
      .poll(() => paths.count(), { timeout: 10000 })
      .toBeLessThanOrEqual(before * 2);
  });
});
