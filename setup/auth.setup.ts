/*
 * Copyright (c) 2025. Deutsche Telekom AG
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
import { test as setup, expect, Page } from '@playwright/test';
import { writeFileSync } from 'fs';
import { sessionStoragePath } from './session-storage';

// Declare the storage state path where the authentication will be saved
const authFile = 'playwright/.auth/user.json';
const mvpOperatorAuthFile = 'playwright/.auth/mvpOperator_user.json';

// const data = fs.readFileSync('playwright/.auth/credentials.json', 'utf-8');
// const credentials = JSON.parse(data);

const username = 'test-admin';
const password = 'password';

// mvp-operator is the only realm user holding mvp_operator, which is what grants
// rat_view_resource. treeview.component.html gates the two tree modes on an exclusive
// @if, so a storage state is either a RAT-view session or a node-view session, never
// both — hence a second login rather than another role on test-admin.
const mvpOperatorUsername = 'mvp-operator';

async function login(
  page: Page,
  user: string,
  pass: string,
  storagePath: string
) {
  // Navigate to your app; this should trigger the redirect to Keycloak
  await page.goto('http://localhost:4200');

  // Wait for the Keycloak login page to load by checking for the username input
  // const currentURL = new URL(page.url());
  // expect(currentURL.hostname).toContain('keycloak');
  await page.waitForSelector('#username'); // Adjust selectors depending on Keycloak page structure
  await page.waitForSelector('#password');

  // Fill in the username and password
  await page.fill('#username', user);
  await page.fill('#password', pass);

  // Click the login button (adjust selector as needed)
  await page.click('#kc-login'); // Default ID for Keycloak login button

  // Wait for the redirect back to the application
  await page.waitForURL('http://localhost:4200/**');

  // Check that the login was successful by ensuring you're on the app page
  expect(page.url()).toContain('http://localhost:4200');

  // Wait for the OIDC tokens to actually land before snapshotting: waitForURL resolves on
  // the redirect back, which can be a tick before angular-oauth2-oidc has written them.
  await page.waitForFunction(
    () => sessionStorage.getItem('access_token') !== null
  );

  // Save the authentication state to a file
  await page.context().storageState({ path: storagePath });

  // storageState covers cookies + localStorage only, and the OIDC tokens live in
  // sessionStorage. Saved next to the storage state and replayed by the auto `context`
  // fixture in e2e/fixtures.ts — see session-storage.ts for what breaks without it.
  const sessionEntries = await page.evaluate(() =>
    JSON.stringify(Object.assign({}, sessionStorage))
  );
  writeFileSync(sessionStoragePath(storagePath), sessionEntries, 'utf-8');
}

setup('Login and save authentication state', async ({ page }) => {
  await login(page, username, password, authFile);
  console.log('Authentication state has been saved.');
});

setup(
  'Login as MVP operator and save authentication state',
  async ({ page }) => {
    await login(page, mvpOperatorUsername, password, mvpOperatorAuthFile);
    console.log('MVP operator authentication state has been saved.');
  }
);
