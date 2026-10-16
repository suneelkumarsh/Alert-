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

import type { Page } from '@playwright/test';
import { expect, test } from '../../fixtures';
import {
  REQUIREMENT_ERRORS,
  REQUIREMENT_LABELS,
  requirementMetCount,
} from './ran-filter.constants';

const panel = (page: Page) => page.locator('.qa_filter_requirements');
const requirements = (page: Page) => page.locator('.qa_filter_requirement');
const requirementErrors = (page: Page) =>
  page.locator('.qa_filter_requirement_error');

/** Adds the first Topology attribute of the default stub and fills its value. */
const addTopologyCondition = async (page: Page, value = 'test-value') => {
  const searchInput = page.locator('.qa_search_attributes_input input');
  await searchInput.fill('node');
  await searchInput.press('Enter');

  const addButton = page.locator('.qa_add_attribute_card_button').first();
  await expect(addButton).toBeVisible();
  await addButton.click();

  await page.locator('.qa_condition_value_input').first().fill(value);
};

test.describe('RAN Filter requirements panel', { tag: '@mvpOperator' }, () => {
  test.use({ locale: 'en' });

  test.beforeEach(async ({ page }) => {
    await page.goto('/ran-filter/create');
    await expect(page.locator('.qa_ran_filter_details_page')).toBeVisible();
  });

  test('lists the three filter requirements', async ({ page }) => {
    await expect(panel(page)).toBeVisible();
    await expect(requirements(page)).toHaveCount(3);

    await expect(requirements(page).nth(0)).toContainText(
      REQUIREMENT_LABELS.topologyAttribute
    );
    await expect(requirements(page).nth(1)).toContainText(
      REQUIREMENT_LABELS.valuesFilled
    );
    await expect(requirements(page).nth(2)).toContainText(
      REQUIREMENT_LABELS.verifyFilter
    );
  });

  test('starts with none of the requirements met', async ({ page }) => {
    await expect(panel(page)).toContainText(requirementMetCount(0, 3));
    await expect(panel(page).locator('.bi-check-circle-fill')).toHaveCount(0);
  });

  test('hides the requirement errors until create filter is clicked', async ({
    page,
  }) => {
    await expect(requirementErrors(page)).toHaveCount(0);

    await page.locator('.qa_save_button').click();

    await expect(requirementErrors(page)).toHaveCount(3);
    await expect(requirementErrors(page).nth(0)).toHaveText(
      REQUIREMENT_ERRORS.topologyAttribute
    );
    await expect(requirementErrors(page).nth(1)).toHaveText(
      REQUIREMENT_ERRORS.valuesFilled
    );
    await expect(requirementErrors(page).nth(2)).toHaveText(
      REQUIREMENT_ERRORS.verifyFilter
    );
  });

  test('ticks the first two requirements once a condition is filled', async ({
    page,
  }) => {
    await addTopologyCondition(page);

    await expect(panel(page)).toContainText(requirementMetCount(2, 3));
    await expect(requirements(page).nth(2)).not.toContainText(
      REQUIREMENT_ERRORS.verifyFilter
    );
  });

  test('enables verify without name and description', async ({ page }) => {
    const verifyButton = page.locator('.qa_verify_button');
    await expect(verifyButton).toBeDisabled();

    await addTopologyCondition(page);

    await expect(verifyButton).toBeEnabled();
  });

  test('completes the checklist after a successful verification', async ({
    page,
  }) => {
    await addTopologyCondition(page);
    await page.locator('.qa_verify_button').click();

    await expect(page.locator('.qa_execute_result_panel')).toBeVisible();
    await expect(panel(page)).toContainText(requirementMetCount(3, 3));
  });

  test('keeps the verified state after closing the result modal', async ({
    page,
  }) => {
    await addTopologyCondition(page);
    await page.locator('.qa_verify_button').click();
    await expect(page.locator('.qa_execute_result_panel')).toBeVisible();

    await page.locator('.qa_execute_result_close').click();

    await expect(page.locator('.qa_execute_result_panel')).toHaveCount(0);
    await expect(panel(page)).toContainText(requirementMetCount(3, 3));
  });

  test('drops the verified state when a condition value changes', async ({
    page,
  }) => {
    await addTopologyCondition(page);
    await page.locator('.qa_verify_button').click();
    await expect(panel(page)).toContainText(requirementMetCount(3, 3));
    await page.locator('.qa_execute_result_close').click();
    await expect(page.locator('.qa_execute_result_panel')).toHaveCount(0);

    await page.locator('.qa_condition_value_input').first().fill('changed');

    await expect(panel(page)).toContainText(requirementMetCount(2, 3));
  });
});

test.describe(
  'RAN Filter requirements panel in edit mode',
  { tag: '@mvpOperator' },
  () => {
    test.use({ locale: 'en' });

    test('uses the update wording for the verify requirement', async ({
      page,
    }) => {
      await page.goto('/ran-filter/edit/1');
      await expect(page.locator('.qa_ran_filter_details_page')).toBeVisible();

      await expect(requirements(page).nth(2)).toContainText(
        REQUIREMENT_LABELS.verifyFilterUpdate
      );
    });
  }
);
