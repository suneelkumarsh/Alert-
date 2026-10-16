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
import { RanTemplateFileBrowserPage } from './ran-template-file-browser.page';

test.describe('RAN template list', () => {
  test('templates route opens the templates list', async ({ page }) => {
    await page.goto('/ran-template/templates');

    await expect(page).toHaveURL(/\/ran-template\/templates$/);
    await expect(page.locator('app-ran-template-list')).toBeVisible();
  });

  test('file browser renders the default README and GitLab action', async ({
    page,
  }) => {
    const fileBrowser = new RanTemplateFileBrowserPage(page);
    await fileBrowser.goto();

    await expect(page.locator('app-ran-template-file-browser')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'README.md' })
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Open in GitLab' })
    ).toHaveAttribute('target', '_blank');
  });
});
