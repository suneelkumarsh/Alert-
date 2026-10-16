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
 * The sessionStorage half of a saved authentication state.
 *
 * `storageState` persists cookies and localStorage only — a `sessionStorage` array in the
 * state object is accepted and silently dropped (verified against Playwright 1.60). But
 * `@portal-mfe/auth` binds the OIDC token store to sessionStorage
 * (`portal-mfe-auth.mjs`: `{ provide: OAuthStorage, useValue: sessionStorage }`), so the
 * access/id/refresh tokens live exactly where the storage state cannot carry them.
 *
 * Consequence when they are missing: the spec still holds the Keycloak SSO cookie, so the
 * app silently re-runs the authorization-code flow (`/?state=…` → `/?iss=…` → back to the
 * route) and **reloads the page** a second or two into the test. Whatever the spec had
 * already located is torn out mid-action, surfacing as
 * `element was detached from the DOM, retrying` — the failure mode that showed up in the
 * treeview configuration specs once workers competed for CPU and shifted that reload into
 * the middle of a click. So this is a latent bug that parallelism exposes, not one it
 * causes: serially the reload usually lands in a gap between actions.
 */
export const SESSION_STORAGE_SUFFIX = '.session.json';

/** Companion file path holding the sessionStorage entries for a storage state. */
export function sessionStoragePath(storageStatePath: string): string {
  return storageStatePath.replace(/\.json$/, '') + SESSION_STORAGE_SUFFIX;
}
