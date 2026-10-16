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

import { Page } from '@playwright/test';
import { expect, test } from '../../fixtures';

test.use({ locale: 'en' });

// The filter stub (getCellSitesFilters.json) yields exactly these four RATs.
const RAT_COUNT = 4;

const message = (page: Page) => page.locator('.qa_map_empty_filter_message');

const ratCheckboxes = (page: Page) =>
  page.locator('.qa_rat-checkbox input[type="checkbox"]');

const ratBandsSelectAll = (page: Page) =>
  page.locator('.qa_rat-select-all input[type="checkbox"]');

const resetButton = (page: Page) => page.locator('.qa_map_empty_filter_reset');

const sitesGroup = (page: Page) => page.locator('.qa_layer-group-SITES');

const sitesSelectAll = (page: Page) =>
  sitesGroup(page).locator('.qa_layer-select-all input[type="checkbox"]');

const openRatFilter = async (page: Page) => {
  // The RAT level is expanded on arrival, so this only waits for the list.
  await expect(ratCheckboxes(page)).toHaveCount(RAT_COUNT);
};

const expandAllRats = async (page: Page) => {
  for (let index = 0; index < RAT_COUNT; index++) {
    await page.locator('.qa_rat-expand').nth(index).click();
  }
  await expect(ratBandsSelectAll(page)).toHaveCount(RAT_COUNT);
};

const openSitesFilter = async (page: Page) => {
  await sitesGroup(page).locator('.qa_layer-group-header').click();
  await expect(sitesSelectAll(page)).toBeVisible();
};

const disableAllRats = async (page: Page) => {
  for (let index = 0; index < RAT_COUNT; index++) {
    await ratCheckboxes(page).nth(index).uncheck();
  }
};

test.describe('Cell Site Map - empty filter message', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cell-site-map');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await page.locator('.qa_map_sidebar_filters').click();
    await expect(page.locator('.qa_map_filter_panel')).toBeVisible();
  });

  test('stays hidden while at least one radio technology is active', async ({
    page,
  }) => {
    await openRatFilter(page);
    await expect(message(page)).toHaveCount(0);

    for (let index = 1; index < RAT_COUNT; index++) {
      await ratCheckboxes(page).nth(index).uncheck();
    }

    await expect(message(page)).toHaveCount(0);
  });

  test('shows the cell wording when every radio technology is disabled', async ({
    page,
  }) => {
    await openRatFilter(page);
    await disableAllRats(page);

    await expect(message(page)).toBeVisible();
    await expect(
      message(page).getByRole('heading', { name: 'No cells to display' })
    ).toBeVisible();
    await expect(
      message(page).getByText(
        'Select at least one radio technology to display cells'
      )
    ).toBeVisible();
  });

  test('shows the site wording when every site type is disabled', async ({
    page,
  }) => {
    await openSitesFilter(page);
    await sitesSelectAll(page).uncheck();

    await expect(message(page)).toBeVisible();
    await expect(
      message(page).getByRole('heading', { name: 'No sites to display' })
    ).toBeVisible();
    await expect(
      message(page).getByText('Select at least one site type to display sites')
    ).toBeVisible();
  });

  test('shows the combined wording when both filters are disabled', async ({
    page,
  }) => {
    await openRatFilter(page);
    await disableAllRats(page);
    await openSitesFilter(page);
    await sitesSelectAll(page).uncheck();

    await expect(message(page)).toBeVisible();
    await expect(
      message(page).getByRole('heading', { name: 'Nothing to display' })
    ).toBeVisible();
    await expect(
      message(page).getByText(
        'Select at least one site type or radio technology to display sites and cells'
      )
    ).toBeVisible();
  });

  test('re-enables both filters via the reset button', async ({ page }) => {
    await openRatFilter(page);
    await disableAllRats(page);
    await openSitesFilter(page);
    await sitesSelectAll(page).uncheck();
    await expect(message(page)).toBeVisible();

    await resetButton(page).click();

    await expect(message(page)).toHaveCount(0);
    await expect(sitesSelectAll(page)).toBeChecked();
    for (let index = 0; index < RAT_COUNT; index++) {
      await expect(ratCheckboxes(page).nth(index)).toBeChecked();
    }
  });

  test('re-enables all radio technologies via the reset button', async ({
    page,
  }) => {
    await openRatFilter(page);
    await disableAllRats(page);
    await expect(message(page)).toBeVisible();

    await resetButton(page).click();

    await expect(message(page)).toHaveCount(0);
    for (let index = 0; index < RAT_COUNT; index++) {
      await expect(ratCheckboxes(page).nth(index)).toBeChecked();
    }
  });

  test('shows the message when every band of every radio technology is deselected', async ({
    page,
  }) => {
    await openRatFilter(page);
    await expandAllRats(page);

    for (let index = 0; index < RAT_COUNT; index++) {
      await ratBandsSelectAll(page).nth(index).uncheck();
    }

    await expect(message(page)).toBeVisible();
    await expect(
      message(page).getByRole('heading', { name: 'No cells to display' })
    ).toBeVisible();
    // The RAT checkboxes stay checked, only their bands were deselected.
    await expect(ratCheckboxes(page).first()).toBeChecked();
  });

  test('moves the focus to the reset button and back to the trigger', async ({
    page,
  }) => {
    await openRatFilter(page);
    for (let index = 0; index < RAT_COUNT - 1; index++) {
      await ratCheckboxes(page).nth(index).uncheck();
    }

    const lastRat = ratCheckboxes(page).nth(RAT_COUNT - 1);
    await lastRat.focus();
    await page.keyboard.press('Space');

    await expect(message(page)).toBeVisible();
    await expect(resetButton(page)).toBeFocused();

    await page.keyboard.press('Escape');

    await expect(message(page)).toHaveCount(0);
    await expect(lastRat).toBeFocused();
  });

  test('dismisses the message via the close button without changing the filter', async ({
    page,
  }) => {
    await openRatFilter(page);
    await disableAllRats(page);
    await expect(message(page)).toBeVisible();

    await page.locator('.qa_map_empty_filter_close').click();

    await expect(message(page)).toHaveCount(0);
    await expect(ratCheckboxes(page).first()).not.toBeChecked();
  });
});
