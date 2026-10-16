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

import { test } from '../../fixtures';
import {
  A11Y_ROUTES,
  ROUTES_BLOCKED_BY_E2E_REALM,
  scanRoute,
} from '../../setup/axe';

// WCAG 2.2 AA regression gate for the `local` (test-admin) identity — see
// `e2e/setup/axe.ts` for what the gate covers, how the allowlist ratchets, and why the
// scan has to run per identity.
//
// This complements rather than replaces the hand-written a11y specs next door: axe reads
// the rendered DOM at rest, so it cannot see a keyboard contract (roving tabindex, focus
// return, arrow navigation) or judge whether a name is *meaningful*. Automation catches
// roughly 57% of WCAG issues by volume; the tree's composite-widget contract in
// `rat-view-a11y.mvp.spec.ts` is most of the other half.

test.describe('Accessibility - WCAG 2.2 AA route scan', () => {
  for (const route of A11Y_ROUTES.filter(r => r.identity !== 'local-mvp')) {
    test(`${route.url} has no WCAG 2.2 AA violations`, async ({
      page,
    }, testInfo) => {
      await scanRoute(page, route.url, testInfo);
    });
  }

  for (const route of ROUTES_BLOCKED_BY_E2E_REALM) {
    /*
     * Skipped with a reason rather than omitted, so the report lists the route as *not
     * covered* instead of leaving no trace at all. Granting the missing realm resources
     * turns each of these into a real test by deleting one list entry.
     */
    test(`${route} has no WCAG 2.2 AA violations`, async ({
      page,
    }, testInfo) => {
      // eslint-disable-next-line playwright/no-skipped-test -- the annotated skip IS the point; see above.
      test.skip(
        true,
        `Unreachable: the e2e Keycloak realm grants neither identity access to ${route} (TNAP-32414).`
      );
      await scanRoute(page, route, testInfo);
    });
  }
});
