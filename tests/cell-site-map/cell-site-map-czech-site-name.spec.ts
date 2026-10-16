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
import { installMapCapture, stubTiles } from './map-test-utils';

/**
 * Site names a Czech deployment really produces. `Ř` is UTF-8 C5 98, and the slash
 * is the second half of the problem: both have to survive as `%C5%98e%C5%BE%2F…`
 * in the path of the follow-up request the detail pane makes.
 *
 * **What this spec does and does not prove.** The map path never encoded manually,
 * so both tests also pass on the revision before this branch — they are not a
 * regression guard for removing the double encoding elsewhere. What they lock in is
 * the expectation that the app hands a site name to the generated client *once*
 * encoded, so a future "fix the mojibake" attempt that re-adds a manual
 * `encodeURIComponent` fails here. The nginx half cannot be covered at all: the dev
 * server forwards the already-encoded URL unchanged, which is precisely why the bug
 * was invisible outside a deployed image.
 *
 * The detail pane builds the complex path segment from `siteName`, so that is the
 * field carrying the slash. The id gets a different string on purpose: the list
 * renders both in their own columns, and identical values would make either
 * rendering assertion match twice. `ď` and `ž` also cover the two failure classes
 * — a second UTF-8 byte java.net.URI rejects outright, and one it accepts and
 * then mangles.
 */
const CZECH_SITE_NAME = 'Řež/Praha';
const CZECH_SITE_NAME_ENCODED = '%C5%98e%C5%BE%2FPraha';
const CZECH_SITE_ID = 'Šumperk Žďár';

const CZECH_SITE = {
  physicalLocationId: CZECH_SITE_ID,
  siteName: CZECH_SITE_NAME,
  insertType: 'Outdoor',
  street1: 'Janackovo nabrezi 1',
  city: 'Praha',
  postalCode: '11000',
  country: 'Czech Republic',
  region: '',
  longitude: 14.408461,
  latitude: 50.076382,
  managedByTNAP: false,
  cellCount: 0,
  cells: [],
};

test.describe('Cell Site Map - site name with Czech diacritics', () => {
  test.beforeEach(async ({ page }) => {
    await installMapCapture(page);
    await stubTiles(page);

    // Own fixture rather than a rewritten Wiremock response: reading `cellSites[0]`
    // off the real stub throws inside the handler if that mapping is ever emptied or
    // reordered, and an unfulfilled route surfaces as a 30 s map timeout instead of a
    // readable failure.
    await page.route('**/api/cell-sites/area**', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ cellSites: [CZECH_SITE], totalCount: 1 }),
      });
    });
  });

  test('sends the site name percent-encoded exactly once', async ({ page }) => {
    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible({
      timeout: 30000,
    });

    await page.locator('.qa_map_sidebar_site_list').click();
    await expect(page.locator('.qa_site_list_table')).toBeVisible();

    const serviceInstances = page.waitForRequest(request =>
      request.url().includes('/service-instances')
    );
    await page.locator('.qa_site_list_open_detail').first().click();

    const url = (await serviceInstances).url();
    expect(url).toContain(
      `complex/${CZECH_SITE_NAME_ENCODED}/service-instances`
    );
    // A double-encoded path would carry %25 here, and raw UTF-8 bytes none of
    // the escapes — both are what the BFF answered 400 (or mojibake) to.
    expect(url).not.toContain('%25');
  });

  test('renders the site name without mojibake', async ({ page }) => {
    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible({
      timeout: 30000,
    });

    await page.locator('.qa_map_sidebar_site_list').click();
    await expect(page.locator('.qa_site_list_table')).toBeVisible();

    const table = page.locator('.qa_site_list_table');
    await expect(table.getByText(CZECH_SITE_ID, { exact: true })).toHaveCount(
      1
    );
    await expect(table.getByText(CZECH_SITE_NAME, { exact: true })).toHaveCount(
      1
    );
  });
});
