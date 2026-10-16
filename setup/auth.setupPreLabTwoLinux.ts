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
import { test as setup, expect, firefox } from '@playwright/test';
import { resolveClusterCredentials, resolveClusterProxy } from './cluster-env';

// Declare portal url in specific cluster
const clusterUrl =
  'https://portal-2.pre-lab.rando.tenant.das-schiff.telekom.de';

// Declare the storage state path where the authentication will be saved
const authFile = 'playwright/.auth/preLabTwoLinux_user.json';

setup('Login and save authentication state', async () => {
  const { username, password } = resolveClusterCredentials();

  // Linux devs reach the cluster through the same local socks5 tunnel as mac,
  // unless E2E_SOCKS_PROXY says otherwise (e.g. a dev VM already inside the network).
  const browser = await firefox.launch({ proxy: resolveClusterProxy(9097) });

  // Unlike the neighbouring auth.setup*.ts files, this one closes the browser it
  // launched. Those leak it; do not copy that here.
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();

    // Navigate to your app; this should trigger the redirect to Keycloak
    await page.goto(clusterUrl);

    /*
     * Pre-lab Keycloak fronts the login form with an identity-provider chooser
     * ("CloudEnabler Keycloak" / "Emergency Account"); do/do1 land on the form directly.
     * Wait for whichever of the two renders — a bare isVisible() check races the OIDC
     * redirect and always loses, since neither is on the page yet at this point — then
     * take the local-account route if the chooser is what showed up.
     */
    const usernameBox = page.getByRole('textbox', { name: /^Username/ });
    const emergencyAccount = page.getByText('Emergency Account', {
      exact: false,
    });
    await usernameBox
      .or(emergencyAccount)
      .first()
      .waitFor({ state: 'visible' });

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
    await context.storageState({ path: authFile });
    console.log('Authentication state has been saved.');
  } finally {
    await browser.close();
  }
});
