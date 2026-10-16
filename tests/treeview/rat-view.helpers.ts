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

import { expect, Locator, Page } from '@playwright/test';

// Shared locators for the RAT tree, used by every *.mvp.spec.ts. They live here rather than in
// one spec because the library's markup contract (see below) is easy to get subtly wrong, and a
// second hand-rolled copy would drift.

/**
 * `@portal-mfe/ng-tree-lib` exposes no qa_ class and no configurable class names, so the row is
 * addressed by its id — that one is part of the library's a11y contract, since the tree's
 * aria-activedescendant points at `treeitem-<key>`.
 *
 * With `[pathScopedKeys]="true"` (set on both tree views), the key is a `/`-separated chain of
 * `aaiType:id` segments, one per ancestor including the node itself — e.g.
 * `network-management-system:nms-e2e-01/service-instance:si-e2e-01/pnf:pnf-e2e-01`. Root nodes
 * remain a single segment. Pass each segment as a separate argument; they are joined with `/`,
 * matching the library's RFC-6901 composition exactly for the ids used in test data (none of which
 * contain `/` or `~`).
 *
 * An attribute selector rather than `#treeitem-…`: the key contains colons and slashes, both of
 * which carry meaning in a CSS id selector and would silently match nothing. (CSS.escape is not
 * an option — it is a DOM global and this file runs in Node.)
 *
 * The first segment is a required parameter rather than part of the rest: a zero-argument call left
 * over from the pre-path signature would otherwise type-check and match no element at all — loud
 * for a positive assertion, silently passing for `toHaveCount(0)` or `not.toBeVisible()`.
 */
export function treeRow(page: Page, first: string, ...rest: string[]): Locator {
  return page.locator(`[id="treeitem-${[first, ...rest].join('/')}"]`);
}

/**
 * The a11y tree's chevron ref is not the element the tree listens on — click the real toggle
 * button inside the row. It is the only button there (checkboxes are off).
 */
export function toggleButton(
  page: Page,
  first: string,
  ...rest: string[]
): Locator {
  return treeRow(page, first, ...rest).getByRole('button', {
    name: /^(Expand|Collapse|Loading)$/,
  });
}

/**
 * A technology filter chip. Matched on the *stable* prefix of its aria-label: the label ends in
 * "(selected)" / "(not selected)", so an exact-name match would only ever find the chip in one of
 * its two states and silently fail in the other.
 */
export function technologyBadge(page: Page, label: string): Locator {
  return page
    .locator('.qa_rat_technology_filter')
    .getByRole('button', { name: new RegExp(`^Filter by ${label} \\(`) });
}

/** The tree's search box. `tnap-input-search` renders one input, tagged with a qa class. */
export function treeSearchInput(page: Page): Locator {
  return page.locator('app-rat-view .qa_search_field');
}

/**
 * A tab in the detail pane's tab bar, by accessible name (ngbNav gives every `ngbNavLink`
 * `role="tab"`). Asserting on the name is what makes a count assertion meaningful: `qa_` classes
 * cannot tell "the tab is missing" from "the tab is there under the wrong label".
 *
 * Note the Configuration tab is labelled **"Network"** (`treeview.detail.tabs.configurations`).
 */
export function detailTab(page: Page, name: 'Plan' | 'Network'): Locator {
  return page
    .locator('app-treeview-detail')
    .getByRole('tab', { name, exact: true });
}

/**
 * Opens a config tab and switches it to the flat table.
 *
 * The table is the addressable view: the tree renders a `key:` label and its value as two sibling
 * elements behind a collapsed chevron, while the table exposes one row per attribute with the 3GPP
 * DN path already built. `ngbNav`'s `destroyOnHide` defaults to true, so the pane is re-created on
 * every switch and the view mode resets to its `'tree'` default each time — hence the toggle here
 * rather than once per test.
 */
export async function openConfigTable(
  page: Page,
  tab: 'Plan' | 'Network'
): Promise<Locator> {
  await detailTab(page, tab).click();

  // Wait for the outgoing pane to be gone before addressing anything inside the new one:
  // `ngbNavOutlet` fades the old pane out, so both config panes are in the DOM for a moment after a
  // switch, and the view toggle's `#tab-table` id is static - two panes mean two matches and a
  // strict-mode failure rather than a wait.
  const pane = page.locator('app-threegpp-treeview');
  await expect(pane).toHaveCount(1);

  // …and for the pane to have rendered its default (tree) view before toggling. Clicking the toggle
  // against a still-initialising pane flaked under parallel load. The mechanism was never pinned
  // down - `viewMode` is written only by `onViewModeChange`, so it is not an `ngOnChanges` reset -
  // so read this as a wait for a rendered pane, not as a claim about what raced.
  await expect(pane.locator('ng-treeview').first()).toBeVisible();

  const tableToggle = pane.locator('.qa_configurations_view_toggle #tab-table');
  await tableToggle.click();
  await expect(tableToggle).toHaveClass(/active/);

  const table = pane.locator('.qa_configurations_table');
  await expect(
    table.locator('tbody tr:not(.loading-row)').first()
  ).toBeVisible();
  return table;
}

/** One flattened attribute row of the config table, narrowed by MO path and attribute name. */
export function configTableRow(
  table: Locator,
  moPath: string,
  attribute: string
): Locator {
  return table
    .locator('tbody tr:not(.loading-row)')
    .filter({ hasText: moPath })
    .filter({ hasText: attribute });
}

/** The URL shape of one entry in the `selectedNodes` deep-link param. */
export interface DeepLinkNode {
  id: string;
  name: string;
  serviceType: string;
  aaiType: string;
  /**
   * Path-scoped identity: root-first list of `aaiType:id` segments identifying one specific
   * occurrence of an entity that may appear under more than one parent. Absent in bookmarks
   * written before path-scoped keys; present in URLs the app writes after selection.
   */
  path?: string[];
}

/**
 * Builds a `/treeview?selectedNodes=…` deep link.
 *
 * Double-encoded on purpose: `page.goto` decodes the URL once before Angular sees it, and
 * TreeviewComponent then runs its own single `decodeURIComponent` — so a link typed into the
 * address bar has to survive both. The app's own navigation gets the second layer from the router,
 * which is why `treeview-configuration-view.spec.ts` encodes only once and still works.
 */
export function deepLinkUrl(nodes: DeepLinkNode[]): string {
  return `/treeview?selectedNodes=${encodeURIComponent(
    encodeURIComponent(JSON.stringify(nodes))
  )}`;
}

/**
 * Types into the tree search and waits for that query's response to land.
 *
 * Waits on the response rather than `networkidle`: the component debounces 500 ms, so at the
 * moment `fill` returns nothing is in flight yet and the network is already idle — the wait would
 * pass before the search was even sent. Only usable for queries long enough to be dispatched
 * (>2 characters); asserting that a shorter one is *not* sent needs the debounce to elapse, which
 * `expectNoSearchRequest` does.
 */
export async function searchTree(page: Page, query: string): Promise<void> {
  const settled = page.waitForResponse(
    response =>
      response.url().includes('/api/ran-treeview?') &&
      response.url().includes(`search=${encodeURIComponent(query)}`)
  );
  await treeSearchInput(page).fill(query);
  await settled;
}

/** Longer than the 500 ms search debounce, with headroom for a slow CI worker. */
const SEARCH_DEBOUNCE_GRACE_MS = 1500;

/**
 * Asserts a too-short query never reaches the wire.
 *
 * The absence of a debounced request cannot be polled for — a poll would sample before the
 * debounce window closes and pass for the wrong reason — so this deliberately waits it out.
 */
export async function expectNoSearchRequest(
  page: Page,
  counter: string[]
): Promise<void> {
  // The assertion is that the debounced request never fires, and there is no event to wait for when
  // nothing happens: any web-first alternative samples before the 500 ms window closes and passes
  // for the wrong reason.
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(SEARCH_DEBOUNCE_GRACE_MS);
  expect(counter).toHaveLength(0);
}

/**
 * Asserts AC2.1's auto-selection did *not* fire.
 *
 * Selection round-trips through the URL (`selectedNodes` → `activatedNodes` → `[selectedIds]`), so
 * `aria-selected` lands a navigation *after* the matched row renders: asserting a count of zero as
 * soon as the row is visible would pass while the selection was still in flight, and the regression
 * this guards - a filter the user typed being auto-selected mid-typing - would go unnoticed. There
 * is no event to wait for when nothing happens, hence the wait.
 */
export async function expectNothingAutoSelected(page: Page): Promise<void> {
  // eslint-disable-next-line playwright/no-wait-for-timeout -- see the doc comment above.
  await page.waitForTimeout(SEARCH_DEBOUNCE_GRACE_MS);
  await expect(
    page.locator('[role="treeitem"][aria-selected="true"]')
  ).toHaveCount(0);
}

/**
 * Waits until the page has stopped talking to the backend.
 *
 * Used only to make a *negative* request assertion sound: `expect.poll` passes on its first
 * matching sample, so a request still in flight when the DOM assertion succeeded would be missed
 * entirely and the test would pass without the behaviour it claims to check. Every caller below
 * asserts a count immediately afterwards — never use this to wait for something to appear, which is
 * what the lint rule is guarding against.
 */
async function waitForRequestsToSettle(page: Page): Promise<void> {
  // eslint-disable-next-line playwright/no-networkidle -- see the doc comment above.
  await page.waitForLoadState('networkidle');
}

/** Asserts no request matching `counter` was ever made. */
export async function expectNoRequests(
  page: Page,
  counter: string[]
): Promise<void> {
  await waitForRequestsToSettle(page);
  expect(counter).toHaveLength(0);
}

/**
 * Asserts a request counter *stops* at `expected`.
 *
 * `expect.poll` is wrong for a negative assertion: it passes on its first matching sample, so a
 * duplicate request still in flight would be missed. This requires the count to hold across
 * consecutive samples instead, which is the only way to observe the absence of a request.
 */
export async function expectRequestsToSettleAt(
  page: Page,
  counter: string[],
  expected: number
): Promise<void> {
  await expect.poll(() => counter.length).toBe(expected);
  await waitForRequestsToSettle(page);
  expect(counter).toHaveLength(expected);
}

export async function navigateToPlanTabAndEnterEditMode(
  page: Page,
  cell: DeepLinkNode
) {
  await page.goto(deepLinkUrl([cell]));

  // Open Plan tab
  const planTab = page.locator('.nav-link.qa_plan_tab_name').first();
  await expect(planTab).toBeVisible();
  await planTab.click();

  // Expand tree
  const expandAllButton = page.getByRole('button', {
    name: 'Expand all',
  });

  await expect(expandAllButton).toBeVisible();
  await expandAllButton.click();

  // Open edit mode
  await page.getByRole('button', { name: 'Edit Attributes' }).click();

  // Verify edit mode controls
  await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible();

  await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible();
}

/**
 * The edit input of one planning attribute row.
 *
 * The config tree is virtualised, so a row below the fold is not in the DOM at all and Playwright
 * cannot scroll it into view the way it would an ordinary off-screen element. The viewport is
 * therefore paged through until the row renders - starting from where it already is, so that a
 * caller walking several attributes does not restart the search each time. Attribute rows are
 * sorted alphabetically behind the section id, so most of them start off-screen.
 */
export async function planAttributeInput(
  page: Page,
  attribute: string
): Promise<Locator> {
  const row = page
    .locator('.tree-attribute-row')
    .filter({ hasText: `${attribute}:` });
  const viewport = page.locator(
    'app-threegpp-treeview-view cdk-virtual-scroll-viewport'
  );

  await expect(viewport).toBeVisible();

  await expect(async () => {
    if ((await row.count()) > 0) {
      return;
    }
    // A full-viewport step leaves no gap: consecutive pages tile the list, so every row renders
    // in at least one of them. At the bottom the walk wraps around to the top.
    await viewport.evaluate(element => {
      const atBottom =
        element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
      element.scrollTop = atBottom
        ? 0
        : element.scrollTop + element.clientHeight;
    });
    throw new Error(`Attribute row "${attribute}:" is not rendered yet`);
  }).toPass({ intervals: [100], timeout: 15000 });

  return row.locator('input');
}
