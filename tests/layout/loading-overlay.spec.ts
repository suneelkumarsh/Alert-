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

import { expect, test } from '../../fixtures';

test.describe('Global loading overlay', () => {
  test('leaves the sidebar usable while a request is pending', async ({
    page,
  }) => {
    // Never answered, so the overlay stays up for the whole test.
    await page.route('**/api/users**', () => {});

    await page.goto('/user-administration/list');
    await expect(page.locator('.loading-overlay')).toBeVisible();

    await page
      .locator('#nav-sidebar')
      .getByRole('link', { name: 'App Starter' })
      .click();

    await expect(page).toHaveURL(/\/app-starter/);
    await expect(page.locator('.loading-overlay')).toBeHidden();

    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});
