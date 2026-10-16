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

import { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { deepLinkUrl, DeepLinkNode, treeRow } from './rat-view.helpers';

// Backward compatibility of pre-path `selectedNodes` URLs, for the NODE view. Runs under the
// `local` project (test-admin has no mvp_operator, so treeview.component.html renders
// <app-node-view>) - the RAT half of the same guarantee is rat-view-deep-link.mvp.spec.ts.
//
// Why this exists: with [pathScopedKeys]="true" the library's identity for every non-root row is
// the *composed* key, and both findFlatNode and expandNodeById are exact lookups. A URL written
// before path-scoped keys carries a bare `aaiType:id`, which can only ever match a root - so a
// legacy bookmark of a nested node selected nothing, expanded nothing and, without the
// (treeLoaded) -> upgradeLegacySelection hook, never repaired itself either. The failure is
// silent: the detail pane still populates through GetNodeFromTreeViewDataPipe's bare-id fallback,
// so only the tree is wrong.
//
// The self-heal is the observable part, hence the URL assertion: the app resolves the bare segment
// against the loaded tree and rewrites the param with the real path.

/** Nested under root `service-instance:73000001` in getTreeview.json - the whole point. */
const LEGACY_PNF: DeepLinkNode = {
  id: 'cf410857-55f2-4cb2-9bfc-959e4c6d0d0f',
  name: '73000001',
  serviceType: 'pnf',
  aaiType: 'pnf',
  // No `path` on purpose: this is the shape every pre-path bookmark has, and the shape
  // cell-table.component.ts still writes today for "Open Cell in Treeview".
};

const SI_SEG = 'service-instance:73000001';
const PNF_SEG = 'pnf:cf410857-55f2-4cb2-9bfc-959e4c6d0d0f';

/**
 * The `selectedNodes` entries the address bar currently carries.
 *
 * Decoded twice: `searchParams.get` undoes the router's own encoding, and the app writes the param
 * `encodeURIComponent`-encoded underneath that. The second decode is a no-op on a param that only
 * went through one layer, so this reads both shapes.
 */
function selectedNodesFromUrl(page: Page): DeepLinkNode[] {
  const raw = new URL(page.url()).searchParams.get('selectedNodes');
  if (!raw) {
    return [];
  }
  return JSON.parse(decodeURIComponent(raw)) as DeepLinkNode[];
}

test.describe('Tree View - node view legacy deep link', () => {
  test('selects and reveals a nested node named without a path', async ({
    page,
  }) => {
    await page.goto(deepLinkUrl([LEGACY_PNF]));
    await expect(page.locator('app-node-view')).toBeVisible();

    await expect(page.locator('[role="treeitem"]').first()).toBeVisible();

    // The ancestor is expanded by the library once the upgraded key reaches [selectedIds], so the
    // row existing at its composed id is already evidence the reveal ran.
    const pnfRow = treeRow(page, SI_SEG, PNF_SEG);
    await expect(pnfRow).toBeVisible({ timeout: 30000 });

    // The *value* carries the meaning - aria-selected is rendered on every row, so a presence
    // check would pass on an unselected one too.
    await expect(pnfRow).toHaveAttribute('aria-selected', 'true');

    // Exactly one row: the ancestor was opened, not activated. This is what would catch a reveal
    // implemented by selecting the whole path.
    await expect(
      page.locator('[role="treeitem"][aria-selected="true"]')
    ).toHaveCount(1);
  });

  test('rewrites the legacy URL with the path it resolved to', async ({
    page,
  }) => {
    await page.goto(deepLinkUrl([LEGACY_PNF]));
    await expect(page.locator('app-node-view')).toBeVisible();

    // Polled, not read once: the upgrade is one extra router navigation that lands after the first
    // tree page has been stamped.
    await expect
      .poll(() => selectedNodesFromUrl(page).map(node => node.path))
      .toEqual([[SI_SEG, PNF_SEG]]);

    // The rest of the entry survives the rewrite - the upgrade adds `path`, it does not rebuild
    // the entry from the tree node. toEqual, not toMatchObject: an extra or rewritten field is
    // exactly the regression this guards.
    expect(selectedNodesFromUrl(page)[0]).toEqual({
      ...LEGACY_PNF,
      path: [SI_SEG, PNF_SEG],
    });
  });
});
