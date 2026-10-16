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

import { test, expect } from '../../fixtures';

test.describe('Resizer Component Accessibility', () => {
  test('should have role=separator and accessibility attributes', async ({
    page,
  }) => {
    await page.goto('/treeview');
    const resizer = page.locator('app-resizer');

    await expect(resizer).toHaveAttribute('role', 'separator');
    await expect(resizer).toHaveAttribute('tabindex', '0');
    await expect(resizer).toHaveAttribute('aria-orientation', 'vertical');

    await expect(resizer).toHaveAttribute('aria-valuemin');
    await expect(resizer).toHaveAttribute('aria-valuemax');
    await expect(resizer).toHaveAttribute('aria-valuenow');
    await expect(resizer).toHaveAttribute('aria-valuetext');
  });

  test('should use provided aria-label when given', async ({ page }) => {
    await page.goto('/treeview');
    const resizer = page.locator('app-resizer');
    await expect(resizer).toHaveAttribute('aria-label', /.+/);
  });

  test('should fall back to translated label when ariaLabel not provided', async ({
    page,
  }) => {
    await page.goto('/treeview');

    const resizer = page.locator('app-resizer');
    const label = await resizer.getAttribute('aria-label');
    expect(label).not.toBeNull();
    expect(label?.length).toBeGreaterThan(0);
  });

  test('should update value with keyboard arrows (screen reader interaction)', async ({
    page,
  }) => {
    await page.goto('/treeview');

    const resizer = page.locator('app-resizer');
    await resizer.focus();
    await expect(resizer).toBeFocused();

    const before = await resizer.getAttribute('aria-valuenow');
    await page.keyboard.press('ArrowRight');

    // Poll rather than snapshot: see the Home-key test for why a bare getAttribute races.
    await expect
      .poll(async () => Number(await resizer.getAttribute('aria-valuenow')))
      .toBeGreaterThan(Number(before));
  });

  test('should move to min value on Home key', async ({ page }) => {
    await page.goto('/treeview');

    const resizer = page.locator('app-resizer');
    await resizer.focus();
    // The keydown handler sits on the resizer host, so a key pressed before focus has
    // landed goes nowhere and the assertion below fails on an unchanged value with no hint
    // as to why. Assert focus first so that failure names itself.
    await expect(resizer).toBeFocused();
    await page.keyboard.press('Home');

    const min = await resizer.getAttribute('aria-valuemin');
    // `getAttribute` takes a single snapshot and never retries, so reading it straight after
    // the keypress races Angular's change detection — under worker contention the old value
    // is still there. `toHaveAttribute` polls until it settles.
    await expect(resizer).toHaveAttribute('aria-valuenow', String(min));
  });

  test('should move to max value on End key', async ({ page }) => {
    await page.goto('/treeview');

    const resizer = page.locator('app-resizer');
    await resizer.focus();
    await expect(resizer).toBeFocused();
    await page.keyboard.press('End');

    const max = await resizer.getAttribute('aria-valuemax');
    await expect(resizer).toHaveAttribute('aria-valuenow', String(max));
  });

  test('should reflect correct aria-valuetext format', async ({ page }) => {
    await page.goto('/treeview');

    const resizer = page.locator('app-resizer');
    const valueText = await resizer.getAttribute('aria-valuetext');
    expect(valueText).toMatch(/(percent|pixels)/);
  });

  test('aria-valuenow should stay within min/max bounds', async ({ page }) => {
    await page.goto('/treeview');

    const resizer = page.locator('app-resizer');
    const min = Number(await resizer.getAttribute('aria-valuemin'));
    const max = Number(await resizer.getAttribute('aria-valuemax'));

    for (let i = 0; i < 50; i++) {
      await resizer.focus();
      await page.keyboard.press('ArrowRight');
    }

    const value = Number(await resizer.getAttribute('aria-valuenow'));
    expect(value).toBeLessThanOrEqual(max);
    expect(value).toBeGreaterThanOrEqual(min);
  });
});
