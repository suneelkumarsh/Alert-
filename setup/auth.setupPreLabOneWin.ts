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
const clusterUrl =
  'https://portal-1.pre-lab.rando.tenant.das-schiff.telekom.de';

// Declare the storage state path where the authentication will be saved
const authFile = 'playwright/.auth/preLabOneWin_user.json';

setup('Login and save authentication state', async ({ page }) => {
  const { username, password } = resolveClusterCredentials();

  // Create the browser launch configuration
  const launchOptions = {} as any;

  launchOptions.proxy = { server: `socks5://127.0.0.1:9097` };

  // Launch the browser
  const browser = await firefox.launch(launchOptions);

  // Create a new context with optional HTTPS error ignoring
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  page = await context.newPage();
  // Navigate to your app; this should trigger the redirect to Keycloak
  await page.goto(clusterUrl);

  /*
   * Pre-lab Keycloak fronts the login form with an identity-provider chooser
   * ("CloudEnabler Keycloak" / "Emergency Account"); do/do1 land on the form directly.
   * Wait for whichever of the two renders — a bare isVisible() check races the OIDC
   * redirect and always loses, since neither is on the page yet at this point — then
   * take the local-account route if the chooser is what showed up. Pre-lab labels the
   * field "Username or email" where do/do1 label it "Username", hence the /^Username/ match.
   */
  const usernameBox = page.getByRole('textbox', { name: /^Username/ });
  const emergencyAccount = page.getByText('Emergency Account', {
    exact: false,
  });
  await usernameBox.or(emergencyAccount).first().waitFor({ state: 'visible' });

  // The two realms render different login entry points, so branching here is the
  // point of this setup rather than something to refactor away.
  // eslint-disable-next-line playwright/no-conditional-in-test
  if (await emergencyAccount.isVisible()) {
    await emergencyAccount.click();
    await usernameBox.waitFor({ state: 'visible' });
  }

  await usernameBox.fill(username);
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
