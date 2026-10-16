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
import { A11Y_ROUTES, scanRoute } from '../../setup/axe';

// The same gate under the `local-mvp` (RAN operator) identity. Both projects are needed:
// the permission guards and `treeview.component.html` make the rendered app a function of
// the session, so each identity reaches routes the other cannot and renders different
// components on the routes they share — `/treeview` is node-view here and the RAT view
// there. Running one project only would report a green gate over an unscanned half.
//
// Realm-blocked routes are listed once, in the non-MVP spec, since neither identity can
// reach them.

test.describe(
  'Accessibility - WCAG 2.2 AA route scan',
  { tag: '@mvpOperator' },
  () => {
    for (const route of A11Y_ROUTES.filter(r => r.identity !== 'local')) {
      test(`${route.url} has no WCAG 2.2 AA violations`, async ({
        page,
      }, testInfo) => {
        await scanRoute(page, route.url, testInfo);
      });
    }
  }
);
