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
import type { Page } from '@playwright/test';

test.describe('RAN Filter edit page', { tag: '@mvpOperator' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ran-filter/edit/1');
    await expect(page.locator('.qa_ran_filter_details_page')).toBeVisible();
  });

  test('URL contains the filter id', async ({ page }) => {
    await expect(page).toHaveURL(/\/ran-filter\/edit\/1/);
  });

  test('shows the breadcrumb with the edit page label', async ({ page }) => {
    const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });

    await expect(
      breadcrumb.getByRole('link', { name: 'RAN Filter' })
    ).toBeVisible();
    await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(
      'Filter Configuration'
    );
  });

  test('pre-populates filter name from existing filter', async ({ page }) => {
    const nameInput = page.locator('.qa_filter_name_input');
    await expect(nameInput).not.toHaveValue('');
  });

  test('pre-populates filter description from existing filter', async ({
    page,
  }) => {
    const descInput = page.locator('.qa_filter_description_input');
    await expect(descInput).not.toHaveValue('');
  });

  test('shows pre-populated conditions table', async ({ page }) => {
    const conditionsTable = page.locator('.qa_conditions_table');
    await expect(conditionsTable).toBeVisible();
  });

  test('save button shows "Update Filter" label', async ({ page }) => {
    const saveButton = page.locator('.qa_save_button');
    await expect(saveButton).toBeVisible();
    await expect(saveButton).toContainText('Update Filter');
  });

  test('can edit filter name', async ({ page }) => {
    const nameInput = page.locator('.qa_filter_name_input');
    // The filter loads asynchronously and overwrites the field, so wait for it first
    await expect(nameInput).not.toHaveValue('');

    await nameInput.clear();
    await nameInput.fill('Updated Filter Name');
    await expect(nameInput).toHaveValue('Updated Filter Name');
  });

  test('cancel button navigates back to filter list', async ({ page }) => {
    const cancelButton = page.getByRole('button', { name: 'Cancel' });
    await cancelButton.click();
    await expect(page).toHaveURL(/\/ran-filter$/);
  });

  test.describe('catalog metadata', () => {
    const conditionRow = (page: Page, path: string) =>
      page.locator('.qa_conditions_table tbody tr').filter({ hasText: path });

    const powerBoostRow = (page: Page) =>
      conditionRow(page, 'node.cell.powerBoost');

    test('applies the type from the catalog instead of defaulting to string', async ({
      page,
    }) => {
      await expect(powerBoostRow(page)).toContainText('integer');
    });

    test('flags a stored value that violates the catalog range', async ({
      page,
    }) => {
      const valueInput = powerBoostRow(page).locator(
        '.qa_condition_value_input'
      );
      // Stored value is 500, the catalog allows 0..100
      await expect(valueInput).toHaveValue('500');
      await expect(valueInput).toHaveClass(/is-invalid/);
      await expect(
        powerBoostRow(page).locator('.qa_condition_value_error')
      ).toBeVisible();
      // Verify is the button that reacts to validation alone
      await expect(page.locator('.qa_execute_button')).toBeDisabled();
    });

    test('shows the range hint once the value is valid', async ({ page }) => {
      const row = powerBoostRow(page);
      await row.locator('.qa_condition_value_input').fill('50');

      const hint = row.locator('.qa_condition_value_range_hint');
      await expect(hint).toBeVisible();
      // 0..100 can only come from the lookup stub, the catch-all serves 0..1000
      await expect(hint).toHaveText('Value must be between 0 and 100');
    });

    test('validates a stored value against the range', async ({ page }) => {
      const valueInput = powerBoostRow(page).locator(
        '.qa_condition_value_input'
      );
      await valueInput.fill('150');
      await expect(valueInput).toHaveClass(/is-invalid/);

      await valueInput.fill('50');
      await expect(valueInput).not.toHaveClass(/is-invalid/);
    });

    test('marks a condition whose attribute is gone and blocks saving', async ({
      page,
    }) => {
      await expect(
        page.locator('.qa_unresolved_conditions_alert')
      ).toBeVisible();
      await expect(page.locator('.qa_condition_unresolved')).toHaveCount(1);
      await expect(page.locator('.qa_execute_button')).toBeDisabled();
    });

    test('renders a stored value the catalog no longer offers as the selected option', async ({
      page,
    }) => {
      const row = conditionRow(page, 'node.equipType');
      const select = row.locator('.qa_condition_value_select');
      await expect(select).toBeVisible();

      const staleOption = select.locator('.qa_condition_stale_value');
      await expect(staleOption).toHaveText('nodeB');
      await expect(staleOption).toBeDisabled();
      // The stale option is the one the select actually shows
      await expect(select).toHaveValue('nodeB');
      await expect(row.locator('.qa_condition_value_error')).toBeVisible();
    });

    test('renders a stored operator the catalog no longer offers as the selected option', async ({
      page,
    }) => {
      const row = conditionRow(page, 'node.cell.cellType');
      const select = row.locator('.qa_condition_operator_select');
      await expect(select).toBeVisible();

      const staleOption = select.locator('.qa_condition_stale_operator');
      await expect(staleOption).toHaveText('LIKE');
      await expect(staleOption).toBeDisabled();
      await expect(select).toHaveValue('LIKE');
      await expect(row.locator('.qa_condition_operator_error')).toBeVisible();
    });

    test('warns about stale selections and blocks verifying', async ({
      page,
    }) => {
      await expect(page.locator('.qa_stale_selection_alert')).toBeVisible();
      await expect(page.locator('.qa_execute_button')).toBeDisabled();
    });

    test('clears the stale operator flag once a catalog operator is picked', async ({
      page,
    }) => {
      const row = conditionRow(page, 'node.cell.cellType');
      const select = row.locator('.qa_condition_operator_select');
      await expect(select.locator('.qa_condition_stale_operator')).toHaveCount(
        1
      );

      await select.selectOption('=');

      await expect(select.locator('.qa_condition_stale_operator')).toHaveCount(
        0
      );
      await expect(row.locator('.qa_condition_operator_error')).toHaveCount(0);
    });

    test('keeps the stale operator message inside its own cell', async ({
      page,
    }) => {
      // node.equipType carries a stale operator and a stale value at once
      const row = conditionRow(page, 'node.equipType');
      const operatorError = row.locator('.qa_condition_operator_error');
      await expect(operatorError).toBeVisible();
      await expect(row.locator('.qa_condition_value_error')).toBeVisible();

      // A nowrap message spills its glyphs into the value column without growing
      // its own box, so bounding boxes cannot see it - compare the text extent.
      const { scrollWidth, clientWidth } = await operatorError.evaluate(el => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    });

    test('enables verifying once every catalog issue is resolved', async ({
      page,
    }) => {
      await expect(page.locator('.qa_execute_button')).toBeDisabled();

      // attribute3 is the last of the four stored conditions, so its row sits at the
      // bottom of the table's own scroll container inside the height-clipped
      // .table-section. Left to Playwright's scroll-into-view the click point keeps
      // landing outside that box - hit-testing onto the stale-selection alert above the
      // table or the name/description row below it - so centre it in the scroller first.
      const removeAttribute3 = conditionRow(
        page,
        'cps.NE.attributes.attribute3'
      ).locator('.qa_remove_condition_button');
      await removeAttribute3.evaluate(el =>
        el.scrollIntoView({ block: 'center' })
      );
      await removeAttribute3.click();

      await conditionRow(page, 'node.cell.powerBoost')
        .locator('.qa_condition_value_input')
        .fill('50');
      await conditionRow(page, 'node.equipType')
        .locator('.qa_condition_operator_select')
        .selectOption('=');
      await conditionRow(page, 'node.equipType')
        .locator('.qa_condition_value_select')
        .selectOption('gNodeB');
      await conditionRow(page, 'node.cell.cellType')
        .locator('.qa_condition_operator_select')
        .selectOption('=');

      await expect(page.locator('.qa_unresolved_conditions_alert')).toHaveCount(
        0
      );
      await expect(page.locator('.qa_stale_selection_alert')).toHaveCount(0);
      await expect(page.locator('.qa_execute_button')).toBeEnabled();
    });
  });
});

test.describe(
  'RAN Filter edit – navigation from list',
  { tag: '@mvpOperator' },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/ran-filter');
      await expect(page.locator('.qa_ran_filter_table')).toBeVisible();
    });

    test('clicking edit button navigates to edit URL with filter id', async ({
      page,
    }) => {
      const firstRow = page
        .locator('.qa_ran_filter_table table tbody tr:not(.loading-row)')
        .first();
      await expect(firstRow).toBeVisible();

      const editButton = firstRow.locator('.qa_filter_action_edit');
      await expect(editButton).toBeVisible();
      await editButton.click();

      await expect(page).toHaveURL(/\/ran-filter\/edit\/\d+/);
    });
  }
);
