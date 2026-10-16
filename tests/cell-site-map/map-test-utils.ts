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

/**
 * Shared fixtures for the Cell Site Map specs: the base map tile stub and the
 * Leaflet map capture, both of which every map spec needs and each had its own
 * copy of.
 */

import { Page } from '../../fixtures';

/** A 1×1 fully transparent PNG — the stand-in for every base map tile. */
export const TRANSPARENT_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=',
  'base64'
);

/**
 * Matches every base map tile request.
 *
 * A RegExp, not a Playwright glob, on purpose: leaflet.service.ts requests
 * https://{s}.tile.openstreetmap.org/… and Leaflet expands {s} to the subdomains
 * a./b./c., but Playwright compiles a leading globstar-plus-slash into a group
 * that requires a literal slash immediately before `tile.`, so it matches none of
 * those hosts. That kind of stub silently never fires and the third-party egress
 * it was meant to remove stays — hence the tile counters the specs assert on.
 */
export const TILE_URL = /tile\.openstreetmap\.org\//;

/**
 * `/api/cell-sites?…` but never `/api/cell-sites/area?…`.
 *
 * A RegExp for a different reason than TILE_URL: the two endpoints differ only by
 * what follows `cell-sites`, and in a Playwright glob `?` is itself a wildcard, so
 * a `cell-sites?` glob would swallow `cell-sites/area` as well.
 */
export const SITE_BY_ID_URL = /\/api\/cell-sites\?/;

/**
 * Serve the OpenStreetMap base map locally, counting the tiles served.
 *
 * Without this the specs make real requests to tile.openstreetmap.org on every
 * pan/zoom: slow, dependent on the corporate proxy reaching the public internet,
 * and an OSM outage or rate-limit would surface as a portal regression.
 *
 * The returned counter is what separates "the tile stub matched" from "the map
 * never asked for a tile" — a stub matching nothing would otherwise look like a
 * passing test.
 */
export async function stubTiles(page: Page): Promise<{ count: number }> {
  const tiles = { count: 0 };
  await page.route(TILE_URL, async route => {
    tiles.count += 1;
    await route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: TRANSPARENT_PNG,
    });
  });
  return tiles;
}

/**
 * Expose the Leaflet map instance on `window.__e2eMap`.
 *
 * Installed as an init script BEFORE navigation so it is in place when the app
 * builds the map: it patches L.Map.prototype.getZoom (which the app calls during
 * render) to stash `this`. Needed because a mouse-drag pan is flaky — a drag that
 * does not cross Leaflet's drag threshold produces no moveend and no /area fetch —
 * and because a canvas-rendered wedge has no element to hover, so the pointer
 * target has to be computed with the map's own latLngToContainerPoint.
 */
export async function installMapCapture(page: Page) {
  await page.addInitScript(() => {
    const install = () => {
      const L = (window as unknown as { L?: typeof import('leaflet') }).L;
      if (!L?.Map?.prototype) {
        setTimeout(install, 20);
        return;
      }
      const originalGetZoom = L.Map.prototype.getZoom;
      L.Map.prototype.getZoom = function (...cbArgs: unknown[]) {
        (window as unknown as { __e2eMap: unknown }).__e2eMap = this;
        return originalGetZoom.apply(this, cbArgs as []);
      };
    };
    install();
  });
}
