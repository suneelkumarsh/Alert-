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

import { test as base } from '@playwright/test';
import { readFileSync } from 'fs';
import { sessionStoragePath } from './setup/session-storage';

/**
 * The project-wide `test` object. **Import `test` from here, not from `@playwright/test`**,
 * so every spec restores its OIDC session — see `setup/session-storage.ts` for why the
 * storage state alone is not enough.
 *
 * `expect` and the types are re-exported unchanged, so a spec needs only to swap the module
 * in its import.
 */
export const test = base.extend({
  /*
   * Auto fixture: runs for every test in every project without the spec opting in.
   *
   * It seeds the tokens through `context.addInitScript`, which applies to each page the
   * context opens (including popups) and runs before any app script — the app's OIDC
   * bootstrap then finds a live session and skips the redirect-and-reload entirely.
   *
   * Keyed off `storageState` rather than a hardcoded path so the `local`, `local-mvp` and
   * cluster projects each pick up their own companion file.
   */
  context: async ({ context, storageState }, use) => {
    if (typeof storageState === 'string') {
      let raw: string | undefined;
      try {
        raw = readFileSync(sessionStoragePath(storageState), 'utf-8');
      } catch {
        // No companion file: the setup project did not run (or predates it). Leave the
        // session empty and let the app authenticate on its own rather than failing every
        // test in the project here.
      }

      if (raw) {
        /*
         * Replaying an EXPIRED token is worse than replaying nothing. With no tokens the
         * app re-runs the code flow and recovers; with a dead one it calls the permission
         * endpoint, gets 401, and every `hasPermissionsGuard` fails closed by redirecting
         * to /statusPage — so the spec fails on a missing selector and points at the
         * feature instead of at the session. Fail here with the real reason instead.
         */
        const expiresAt = Number(
          (JSON.parse(raw) as Record<string, string>)['expires_at']
        );
        if (expiresAt && Date.now() >= expiresAt) {
          throw new Error(
            `Stored OIDC access token expired at ${new Date(expiresAt).toISOString()}. ` +
              `Re-run the setup project to mint a fresh one, and check the e2e realm's ` +
              `accessTokenLifespan covers a full suite run.`
          );
        }

        await context.addInitScript(entries => {
          for (const [key, value] of Object.entries(
            JSON.parse(entries) as Record<string, string>
          )) {
            sessionStorage.setItem(key, value);
          }
        }, raw);
      }
    }

    await use(context);
  },
});

export { expect } from '@playwright/test';
export type { Locator, Page } from '@playwright/test';
