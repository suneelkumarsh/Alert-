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
import { test as setup, expect, firefox } from '@playwright/test';
import { resolveClusterCredentials } from './cluster-env';

// Declare portal url in specific cluster
const clusterUrl = 'https://portal-do-dev-argo.tnaplab.telekom.de';

// Declare the storage state path where the authentication will be saved
const authFile = 'playwright/.auth/doWin_user.json';

setup('Login and save authentication state', async ({ page }) => {
  const { username, password } = resolveClusterCredentials();

  // Launch the browser
  const browser = await firefox.launch();

  // Create a new context with optional HTTPS error ignoring
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  page = await context.newPage();
  // Navigate to your app; this should trigger the redirect to Keycloak
  await page.goto(clusterUrl);
  await page.getByRole('textbox', { name: 'Username' }).fill(username);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for the redirect back to the application
  await page.waitForURL(`${clusterUrl}/**`);

  // Check that the login was successful by ensuring you're on the app page
  expect(page.url()).toContain(clusterUrl);

  // Save the authentication state to a file
  await page.context().storageState({ path: authFile });
  console.log('Authentication state has been saved.');
});
