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

import AxeBuilder from '@axe-core/playwright';
import { expect, Page, TestInfo } from '@playwright/test';
import type { Result } from 'axe-core';

/*
 * WCAG 2.2 Level AA — nothing more. The EU Accessibility Act and the German BFSG make
 * exactly this set a legal obligation for the Portal, which is why the gate is scoped to
 * it. axe's `best-practice` tag is deliberately excluded: those rules are opinions rather
 * than the standard, and mixing them in makes a red build arguable, which is how a gate
 * ends up switched off.
 */
export const WCAG_TAGS = [
  'wcag2a',
  'wcag2aa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
];

export interface A11yRoute {
  url: string;
  /**
   * Which e2e identity can reach this route. Omitted means both.
   *
   * `treeview.component.html` and the permission guards make the rendered app a function
   * of the session's permissions, so route coverage is per-project rather than global.
   */
  identity?: 'local' | 'local-mvp';
}

/**
 * Every route the scan visits. One `test()` per entry per project, so a failure names the
 * broken route instead of aborting a single long loop at the first one.
 *
 * Routes are the app's static, parameter-free ones. Deep-linked detail views need a
 * fixture id and are covered by their own feature specs.
 */
export const A11Y_ROUTES: A11yRoute[] = [
  { url: '/administration/ran-importer' },
  { url: '/administration/reconciliation' },
  { url: '/administration/service-area-extension' },
  { url: '/app-starter' },
  { url: '/cell-site-map' },
  { url: '/cm-action/list' },
  { url: '/credits' },
  { url: '/discrepancy/discrepancy-list' },
  { url: '/not-found' },
  { url: '/policies/capacity' },
  { url: '/policies/cell-restriction' },
  { url: '/policies/offset' },
  { url: '/policies/sfc' },
  { url: '/policy-builder/list-policy' },
  { url: '/ran-template/file-browser', identity: 'local' },
  { url: '/service-instance/list' },
  { url: '/slice-management/slice-history' },
  { url: '/slice-management/slice-list' },
  { url: '/slice-management/slice-logs' },
  { url: '/slice-management/slice-orders' },
  { url: '/slice-management/slice-template' },
  { url: '/slice-management/slice-template/create' },
  { url: '/statusPage' },
  { url: '/task-flow/tasks' },
  { url: '/task-flow/tasks/create' },
  { url: '/task-flow/workflow' },
  { url: '/task-flow/workflow/create' },
  { url: '/treeview' },
  { url: '/user-administration/create', identity: 'local' },
  { url: '/user-administration/list', identity: 'local' },
  { url: '/ran-filter', identity: 'local-mvp' },
  { url: '/ran-filter/create', identity: 'local-mvp' },
];

/**
 * Routes neither e2e identity can reach: the e2e Keycloak realm has no resource granting
 * them, so both `local` and `local-mvp` redirect to `/statusPage`. They are listed here
 * rather than omitted so the gap stays visible — roughly a quarter of the app's routes
 * cannot be scanned at all until the realm grows the missing resources (TNAP-32414).
 */
export const ROUTES_BLOCKED_BY_E2E_REALM = [
  '/administration/ran-data-importer',
  '/alarm/list',
  '/dashboard',
  '/ru-management/create',
  '/ru-management/list',
  '/s3-storage-browser',
  '/service-model-deployment',
  '/service-model-deployment/planned-instances',
  '/sw-management/available',
  '/sw-management/deployed',
];

export interface KnownIssue {
  /** axe rule id, e.g. `button-name`. */
  rule: string;
  /**
   * Matched against the violating node's CSS target *and* its rendered HTML. Scoping by
   * element rather than by rule alone is what keeps the entry narrow: a *new* instance of
   * the same rule elsewhere in the app still fails the build.
   *
   * The HTML is included because axe emits the shortest *unique* selector it can, so a
   * class the entry is written against often does not appear in the target at all —
   * `.page-link` reduces to `span[aria-live="polite"]` once it is unique on the page.
   */
  target: RegExp;
  /**
   * The routes this entry covers — and, because the allowlist is a two-way ratchet, the
   * routes it must still fire on. `'all'` is for app-shell defects that appear on every
   * route; anything else has to be enumerated so a widget-specific defect appearing on a
   * *new* route is still a failure.
   */
  routes: string[] | 'all';
  /**
   * Restrict the entry to one Playwright project. Needed where the defect is a function of
   * the session's permissions rather than of the route — `/treeview` renders node-view
   * under `local` and the RAT view under `local-mvp`, for instance.
   */
  project?: 'local' | 'local-mvp';
  /** Who has to fix it — this repo, or a library that needs its own MR plus a bump. */
  owner: string;
  ticket: string;
  why: string;
}

/**
 * The only accepted WCAG failures. Every entry needs an owner and a ticket, and the gate
 * enforces the allowlist in BOTH directions: an unlisted violation fails, and a listed
 * one that no longer fires fails too, with a note to delete the entry. Without that
 * second half the list quietly becomes a graveyard and the gate erodes.
 */
export const KNOWN_ISSUES: KnownIssue[] = [
  {
    rule: 'aria-valid-attr-value',
    target: /#ngb-nav-/,
    routes: [
      '/administration/ran-importer',
      '/administration/reconciliation',
      '/administration/service-area-extension',
    ],
    owner: '@ng-bootstrap/ng-bootstrap',
    ticket: 'TNAP-32415',
    why:
      'ngb-nav points aria-controls at a tab panel that is not in the DOM until the tab ' +
      'is activated. Upstream behaviour; needs a destroyOnHide decision per tabset.',
  },
  {
    rule: 'scrollable-region-focusable',
    target: /#main/,
    routes: ['/credits'],
    owner: 'portal-ui',
    ticket: 'TNAP-32415',
    why:
      '<main> is the skip-link target so it carries tabindex="-1" — programmatically ' +
      'focusable but not keyboard-reachable, so a keyboard user cannot scroll it where ' +
      'the content overflows. Changing it to 0 adds a tab stop on every route, which is ' +
      'a shell-wide decision.',
  },
  {
    rule: 'scrollable-region-focusable',
    target: /tree-viewport/,
    routes: ['/treeview'],
    // Only the RAT view fills its viewport past the scroll threshold with the stubbed tree.
    project: 'local-mvp',
    owner: '@portal-mfe/ng-tree-lib',
    ticket: 'TNAP-32960',
    why:
      'The scroll container is the inner <cdk-virtual-scroll-viewport role="tree">, but the ' +
      'library puts tabindex="0" on the outer .tree-wrapper and gives a row tabindex="0" only ' +
      'once focusedNodeId() is set — so before first focus the scrollable region has neither ' +
      'focusable content nor focus itself. Cannot be fixed here: adding tabindex to the ' +
      'viewport from the app would create a second tab stop inside the composite widget, ' +
      'which rat-view-a11y.mvp.spec.ts asserts against. Needs an ng-tree-lib MR plus a bump.',
  },
];

/**
 * Wait until the route has finished rendering.
 *
 * `<main id="main">` carries `[attr.aria-busy]` for the duration of the view's loads, which
 * makes it the app's own "settled" signal and avoids both a fixed sleep and scanning the
 * loading overlay's placeholder DOM. A route that stays busy is scanned anyway rather than
 * failing here: a stuck spinner is a different bug, and axe still reports usefully on it.
 */
async function settle(page: Page): Promise<void> {
  await page
    .locator('main#main')
    .waitFor({ state: 'attached', timeout: 20_000 });
  /*
   * Every accessible name in the shell comes from `| translate`, and the pipe renders an empty
   * string until the merged translation bundle resolves — so a scan that starts too early
   * reports the whole header and sidemenu as nameless, and can equally keep a listed issue
   * from firing, which the ratchet fails on too. `<main>` carries a translated aria-label on
   * every route, which makes it the one available signal that the bundle has applied.
   */
  await page
    .locator('main#main[aria-label]:not([aria-label=""])')
    .waitFor({ state: 'attached', timeout: 15_000 });
  await page
    .locator('main#main[aria-busy="true"]')
    .waitFor({ state: 'detached', timeout: 15_000 })
    .catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  /*
   * The one place in the suite where a fixed wait is the right tool: it is not waiting for a
   * known element (that is what the two locators above do) but for the *absence* of further
   * rendering. Several views paint their table body a frame or two after aria-busy clears,
   * and color-contrast resolves real computed pixels, so scanning too early produces
   * findings that do not survive a rerun. There is no app-side signal for "nothing more is
   * coming". Measured stable across both projects and 86 route visits.
   */
  // eslint-disable-next-line playwright/no-wait-for-timeout
  await page.waitForTimeout(1_200);
}

function appliesTo(issue: KnownIssue, route: string, project: string): boolean {
  if (issue.project && issue.project !== project) {
    return false;
  }
  return issue.routes === 'all' || issue.routes.includes(route);
}

function formatViolations(violations: Result[]): string {
  return violations
    .map(v => {
      const nodes = v.nodes
        .map(
          n =>
            `      ${n.target.join(' ')}\n        ${n.html.replace(/\s+/g, ' ')}`
        )
        .join('\n');
      return `  [${v.impact}] ${v.id} — ${v.help}\n    ${v.helpUrl}\n${nodes}`;
    })
    .join('\n\n');
}

/**
 * Navigate to `route`, wait for it to settle, and fail on any WCAG 2.2 AA violation that
 * is not in `KNOWN_ISSUES`.
 *
 * There is deliberately no per-element assertion anywhere in this suite: axe supplies the
 * rules, so a new nameless button or invalid ARIA attribute fails without anyone writing
 * a test for it. The only things this file maintains are the route list and the allowlist.
 */
export async function scanRoute(
  page: Page,
  route: string,
  testInfo: TestInfo
): Promise<void> {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await settle(page);

  /*
   * Without this the scan silently reports a pass for routes it never reached: a
   * permission guard redirects to /statusPage, axe scans the status page instead, and the
   * route looks covered. Measured on the first draft of this suite - 15 of 43 routes.
   */
  expect(
    new URL(page.url()).pathname,
    `${route} redirected to /statusPage — a missing e2e realm permission, not an a11y pass. ` +
      `Add it to ROUTES_BLOCKED_BY_E2E_REALM or grant the resource in the e2e realm.`
  ).toBe(route);

  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  await testInfo.attach(`axe-${route.replace(/\//g, '_')}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });

  const applicable = KNOWN_ISSUES.filter(i =>
    appliesTo(i, route, testInfo.project.name)
  );
  const fired = new Set<KnownIssue>();
  const unexpected: Result[] = [];

  for (const violation of results.violations) {
    const nodes = violation.nodes.filter(node => {
      const element = `${node.target.join(' ')} ${node.html}`;
      const issue = applicable.find(
        i => i.rule === violation.id && i.target.test(element)
      );
      if (issue) {
        fired.add(issue);
        return false;
      }
      return true;
    });
    if (nodes.length) {
      unexpected.push({ ...violation, nodes });
    }
  }

  const stale = applicable.filter(i => !fired.has(i));

  expect(
    unexpected,
    `${route}: ${unexpected.length} unexpected WCAG 2.2 AA violation(s)\n\n` +
      `${formatViolations(unexpected)}\n`
  ).toEqual([]);

  /*
   * The other half of the ratchet. An entry that stopped firing means the defect is fixed
   * (or the selector drifted) - either way the entry must go, or the allowlist rots into a
   * list of things nobody checks any more.
   */
  expect(
    stale.map(i => `${i.rule} (${i.ticket}, ${i.owner})`),
    `${route}: KNOWN_ISSUES entries that no longer fire. Delete them from ` +
      `e2e/setup/axe.ts — the defect they document is gone.`
  ).toEqual([]);
}
