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
import {
  CONDITIONS_HINT_TEXT,
  RAN_FILTER_SOURCES,
  SOURCE_LABELS,
  sourceBadge,
} from './ran-filter.constants';

// Wiremock returns [Ericsson, Huawei, Nokia] and the app preselects the default
// vendor Huawei, so "switch vendor" interactions must target a different entry.
const OTHER_VENDOR = 'Ericsson';

const vendorRadio = (page: Page, vendor: string) =>
  page.locator(`.qa_vendor_radio[value="${vendor}"]`);

test.describe(
  'RAN Filter details (create) page',
  { tag: '@mvpOperator' },
  () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/ran-filter/create');
      await expect(page.locator('.qa_ran_filter_details_page')).toBeVisible();
    });

    test('shows the page header', async ({ page }) => {
      await expect(page.locator('.qa_ran_filter_details_page')).toBeVisible();
    });

    test('shows the breadcrumb with the create page label', async ({
      page,
    }) => {
      const breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });

      await expect(
        breadcrumb.getByRole('link', { name: 'RAN Filter' })
      ).toBeVisible();
      await expect(breadcrumb.locator('[aria-current="page"]')).toHaveText(
        'Create Filter'
      );
    });

    test('displays filter name and description inputs', async ({ page }) => {
      const nameInput = page.locator('.qa_filter_name_input');
      const descInput = page.locator('.qa_filter_description_input');

      await expect(nameInput).toBeVisible();
      await expect(descInput).toBeVisible();
      await expect(nameInput).toHaveValue('');
      await expect(descInput).toHaveValue('');
    });

    test('displays vendor radio buttons from the API', async ({ page }) => {
      const vendorSelection = page.locator('.qa_vendor_selection');
      await expect(vendorSelection).toBeVisible();

      await expect(page.locator('.qa_vendor_radio')).toHaveCount(3);
    });

    test('preselects the default vendor Huawei', async ({ page }) => {
      await expect(vendorRadio(page, 'Huawei')).toBeChecked();
      await expect(page.locator('.qa_vendor_radio:checked')).toHaveCount(1);
    });

    test('shows search section after selecting a vendor', async ({ page }) => {
      // The default vendor is auto-selected on load, search section is immediately visible
      const searchInput = page.locator('.qa_search_attributes_input');
      await expect(searchInput).toBeVisible();

      // Switching to another vendor also keeps search section visible
      await vendorRadio(page, OTHER_VENDOR).click();
      await expect(searchInput).toBeVisible();
    });

    test('searches attributes and displays results', async ({ page }) => {
      // Expand to table view (default is card view)
      await page.locator('.qa_toggle_left_pane_expand_button').click();

      const searchInput = page.locator('.qa_search_attributes_input input');
      await searchInput.fill('NE');
      await searchInput.press('Enter');

      const resultsTable = page.locator('.qa_search_results_table');
      await expect(resultsTable).toBeVisible();

      const rows = resultsTable.locator('table tbody tr:not(.loading-row)');
      await expect(rows.first()).toBeVisible();
    });

    test('adds a condition from search results', async ({ page }) => {
      // Default view is card view; vendor is auto-selected, search is immediately available
      const searchInput = page.locator('.qa_search_attributes_input input');
      await searchInput.fill('node');
      await searchInput.press('Enter');

      const addButton = page.locator('.qa_add_attribute_card_button').first();
      await expect(addButton).toBeVisible();
      await addButton.click();

      const conditionsTable = page.locator('.qa_conditions_table');
      await expect(conditionsTable).toBeVisible();
    });

    test('can collapse and expand the search section', async ({ page }) => {
      const toggleButton = page.locator('.qa_toggle_left_pane_expand_button');
      await expect(toggleButton).toBeVisible();

      // By default the card view is shown (table not visible)
      const resultsTable = page.locator('.qa_search_results_table');
      await expect(resultsTable).toBeHidden();

      // Expand: table view appears
      await toggleButton.click();
      await expect(resultsTable).toBeVisible();

      // Collapse: table view disappears
      await toggleButton.click();
      await expect(resultsTable).toBeHidden();
    });

    test('cancel button navigates back to the list', async ({ page }) => {
      const cancelButton = page.locator('.qa_cancel_button');
      await expect(cancelButton).toBeVisible();
      await cancelButton.click();

      await page.waitForURL('**/ran-filter');
      await expect(page.locator('.qa_ran_filter_page')).toBeVisible();
    });

    test('verify is disabled and create stays enabled on an empty form', async ({
      page,
    }) => {
      // Create validates on click, so it must stay operable to surface the errors.
      await expect(page.locator('.qa_save_button')).toBeEnabled();
      await expect(page.locator('.qa_execute_button')).toBeDisabled();
    });

    test('reports missing name and description when create is clicked', async ({
      page,
    }) => {
      await page.locator('.qa_save_button').click();

      await expect(page.locator('.qa_filter_name_error')).toBeVisible();
      await expect(page.locator('.qa_filter_description_error')).toBeVisible();
      await expect(page.locator('.qa_filter_name_input')).toHaveClass(
        /is-invalid/
      );
    });

    test('allows verification of a Topology-only filter', async ({ page }) => {
      // --- Add one Topology (AAI) condition ---
      // No source badge active → default stub returns AAI attributes
      const searchInput = page.locator('.qa_search_attributes_input input');
      await searchInput.fill('node');
      await searchInput.press('Enter');

      const addButton = page.locator('.qa_add_attribute_card_button').first();
      await expect(addButton).toBeVisible();
      await addButton.click();

      // Fill in AAI condition value
      const conditionValueInputs = page.locator('.qa_condition_value_input');
      await conditionValueInputs.first().fill('test-value');

      // A Topology-only filter is valid; name and description are not required
      // for verification and CPS is optional.
      await expect(page.locator('.qa_execute_button')).toBeEnabled();
    });

    test('create button on list page navigates to create page', async ({
      page,
    }) => {
      await page.goto('/ran-filter');

      const createButton = page.locator('.qa_create_filter_button');
      await expect(createButton).toBeVisible();
      await createButton.click();

      await page.waitForURL('**/ran-filter/create');
      await expect(page.locator('.qa_ran_filter_details_page')).toBeVisible();
    });

    test('remove selected conditions button is visible and disabled initially', async ({
      page,
    }) => {
      const removeButton = page.locator('.qa_remove_selected_conditions');
      await expect(removeButton).toBeVisible();
      await expect(removeButton).toBeDisabled();
    });

    test('conditions table shows checkboxes column header', async ({
      page,
    }) => {
      const conditionsTable = page.locator('.qa_conditions_table');
      await expect(conditionsTable).toBeVisible();
      const masterCheckbox = conditionsTable.locator(
        'thead input[type="checkbox"]'
      );
      await expect(masterCheckbox).toBeVisible();
    });

    test('shows attribute cards on initial load in card view', async ({
      page,
    }) => {
      // Auto-search runs on load with the default vendor → results are shown immediately
      const attributeCards = page.locator('.qa_attribute_cards');
      await expect(attributeCards).toBeVisible();
      await expect(page.locator('.qa_attribute_card').first()).toBeVisible();
    });

    test('card view shows updated results after searching for a term', async ({
      page,
    }) => {
      const searchInput = page.locator('.qa_search_attributes_input input');
      await searchInput.fill('node');
      await searchInput.press('Enter');

      // Results are shown as attribute cards
      await expect(page.locator('.qa_attribute_cards')).toBeVisible();
      await expect(
        page.locator('.qa_add_attribute_card_button').first()
      ).toBeVisible();
    });

    test('card view shows empty state when search returns no results', async ({
      page,
    }) => {
      // Switch to Nokia
      await vendorRadio(page, 'Nokia').click();

      // Search for "cell" – wiremock returns empty for Nokia + cell
      const searchInput = page.locator('.qa_search_attributes_input input');
      await searchInput.fill('cell');
      await searchInput.press('Enter');

      await expect(page.locator('.qa_attribute_cards_empty')).toBeVisible();
      await expect(page.locator('.qa_attribute_cards')).toBeHidden();
    });

    test('shows conditions hint when no conditions have been added', async ({
      page,
    }) => {
      const conditionsHint = page.locator('.qa_conditions_hint_alert');
      await expect(conditionsHint).toBeVisible();
      await expect(conditionsHint).toContainText(CONDITIONS_HINT_TEXT);
    });

    test('conditions hint can be dismissed', async ({ page }) => {
      const conditionsHint = page.locator('.qa_conditions_hint_alert');
      await expect(conditionsHint).toBeVisible();

      const closeButton = conditionsHint.locator('button[aria-label]');
      await closeButton.click();

      await expect(conditionsHint).toBeHidden();
    });

    test.describe('source filter badges', () => {
      // The vendors arrive from the API and auto-select the default vendor, which
      // re-renders the form. Clicking a badge before that drops the pressed state.
      test.beforeEach(async ({ page }) => {
        await expect(page.locator('.qa_vendor_radio')).toHaveCount(3);
        await expect(page.locator('.qa_source_badge')).toHaveCount(
          RAN_FILTER_SOURCES.length
        );
      });

      test('shows the source filter badges in model order', async ({
        page,
      }) => {
        const badges = page.locator('.qa_source_badge');
        await expect(badges).toHaveCount(RAN_FILTER_SOURCES.length);
        for (const [index, source] of RAN_FILTER_SOURCES.entries()) {
          await expect(badges.nth(index)).toContainText(SOURCE_LABELS[source]);
        }
      });

      test('no badge is active by default', async ({ page }) => {
        const activeBadges = page.locator(
          '.qa_source_badge.source-badge--active'
        );
        await expect(activeBadges).toHaveCount(0);
        const badges = page.locator('.qa_source_badge');
        for (let i = 0; i < 3; i++) {
          await expect(badges.nth(i)).toHaveAttribute('aria-pressed', 'false');
        }
      });

      test('clicking CPS badge makes it active and deactivates others', async ({
        page,
      }) => {
        const cpsBadge = sourceBadge(page, 'CPS');
        const planningBadge = sourceBadge(page, 'PLANNING');
        const aaiBadge = sourceBadge(page, 'AAI');

        await cpsBadge.click();

        await expect(cpsBadge).toHaveClass(/source-badge--active/);
        await expect(cpsBadge).toHaveAttribute('aria-pressed', 'true');
        await expect(planningBadge).not.toHaveClass(/source-badge--active/);
        await expect(planningBadge).toHaveAttribute('aria-pressed', 'false');
        await expect(aaiBadge).not.toHaveClass(/source-badge--active/);
        await expect(aaiBadge).toHaveAttribute('aria-pressed', 'false');
      });

      test('clicking PLANNING badge makes it active', async ({ page }) => {
        const planningBadge = sourceBadge(page, 'PLANNING');

        await planningBadge.click();

        await expect(planningBadge).toHaveClass(/source-badge--active/);
        await expect(planningBadge).toHaveAttribute('aria-pressed', 'true');
      });

      test('only one badge is active at a time', async ({ page }) => {
        await sourceBadge(page, 'CPS').click();

        const activeBadges = page.locator(
          '.qa_source_badge.source-badge--active'
        );
        await expect(activeBadges).toHaveCount(1);
      });

      test('clicking an active badge deselects it', async ({ page }) => {
        const planningBadge = sourceBadge(page, 'PLANNING');

        await planningBadge.click();
        await expect(planningBadge).toHaveClass(/source-badge--active/);

        await planningBadge.click();
        await expect(planningBadge).not.toHaveClass(/source-badge--active/);
        await expect(planningBadge).toHaveAttribute('aria-pressed', 'false');
      });
    });

    test.describe('vendor change confirmation modal', () => {
      test('switching vendor without conditions does not show modal', async ({
        page,
      }) => {
        // No conditions added – switch vendor directly
        await vendorRadio(page, OTHER_VENDOR).click();

        const modal = page.locator('ngb-modal-window');
        await expect(modal).toBeHidden();
      });

      test('switching vendor with conditions shows confirmation modal', async ({
        page,
      }) => {
        // Add a condition first
        const searchInput = page.locator('.qa_search_attributes_input input');
        await searchInput.fill('node');
        await searchInput.press('Enter');

        const addButton = page.locator('.qa_add_attribute_card_button').first();
        await expect(addButton).toBeVisible();
        await addButton.click();

        // Now switch vendor
        await vendorRadio(page, OTHER_VENDOR).click();

        const modal = page.locator('ngb-modal-window');
        await expect(modal).toBeVisible();
      });

      test('confirming vendor change clears all conditions', async ({
        page,
      }) => {
        // Add a condition
        const searchInput = page.locator('.qa_search_attributes_input input');
        await searchInput.fill('node');
        await searchInput.press('Enter');

        const addButton = page.locator('.qa_add_attribute_card_button').first();
        await expect(addButton).toBeVisible();
        await addButton.click();

        // Switch vendor → modal appears
        await vendorRadio(page, OTHER_VENDOR).click();

        const modal = page.locator('ngb-modal-window');
        await expect(modal).toBeVisible();

        // Confirm
        const confirmButton = modal.locator('button.qa_apply_button');
        await confirmButton.click();

        await expect(modal).toBeHidden();
        // Conditions hint is shown again (conditions table should be empty)
        await expect(page.locator('.qa_conditions_hint_alert')).toBeVisible();
      });

      test('cancelling vendor change keeps conditions intact', async ({
        page,
      }) => {
        // Add a condition
        const searchInput = page.locator('.qa_search_attributes_input input');
        await searchInput.fill('node');
        await searchInput.press('Enter');

        const addButton = page.locator('.qa_add_attribute_card_button').first();
        await expect(addButton).toBeVisible();
        await addButton.click();

        const conditionsTable = page.locator('.qa_conditions_table');
        await expect(conditionsTable).toBeVisible();

        // Switch vendor → modal appears
        await vendorRadio(page, OTHER_VENDOR).click();

        const modal = page.locator('ngb-modal-window');
        await expect(modal).toBeVisible();

        // Cancel
        const cancelButton = modal.locator('button.qa_cancel_button');
        await cancelButton.click();

        await expect(modal).toBeHidden();
        // Conditions table still visible (conditions not cleared)
        await expect(conditionsTable).toBeVisible();
      });

      test('source selection is preserved after vendor change confirmation', async ({
        page,
      }) => {
        // Wait for vendor list to be loaded and stable before interacting with source badges
        const vendorItem = page.locator('.qa_vendor_radio').first();
        await expect(vendorItem).toBeVisible();

        // Switch to CPS source
        const cpsBadge = sourceBadge(page, 'CPS');
        await expect(cpsBadge).toBeVisible();
        await cpsBadge.click();
        await expect(cpsBadge).toHaveClass(/source-badge--active/);

        // Add a condition
        const searchInput = page.locator('.qa_search_attributes_input input');
        await searchInput.fill('node');
        await searchInput.press('Enter');

        const addButton = page.locator('.qa_add_attribute_card_button').first();
        if (await addButton.isVisible()) {
          await addButton.click();

          // Switch vendor → confirm
          await vendorRadio(page, OTHER_VENDOR).click();

          const modal = page.locator('ngb-modal-window');
          if (await modal.isVisible()) {
            const confirmButton = modal.locator('button.qa_apply_button');
            await confirmButton.click();
            await expect(modal).toBeHidden();
          }

          // CPS badge should still be active
          await expect(cpsBadge).toHaveClass(/source-badge--active/);
        }
      });
    });

    test.describe('integer range guidance and validation', () => {
      const RANGE_ATTRIBUTE = 'node.cell.powerBoost';

      const addRangeCondition = async (page: Page) => {
        const searchInput = page.locator('.qa_search_attributes_input input');
        await searchInput.fill('node');
        await searchInput.press('Enter');

        const card = page
          .locator('.qa_attribute_card')
          .filter({ hasText: RANGE_ATTRIBUTE });
        await expect(card).toBeVisible();
        await card.locator('.qa_add_attribute_card_button').click();

        const valueInput = page.locator('.qa_condition_value_input').first();
        await expect(valueInput).toBeVisible();
        return valueInput;
      };

      test('shows the valid range below the value input', async ({ page }) => {
        await addRangeCondition(page);

        const rangeHint = page.locator('.qa_condition_value_range_hint');
        await expect(rangeHint).toBeVisible();
        await expect(rangeHint).toContainText('0');
        await expect(rangeHint).toContainText('1000');
      });

      test('marks a value above the maximum as invalid', async ({ page }) => {
        const valueInput = await addRangeCondition(page);

        await valueInput.fill('1002');

        await expect(valueInput).toHaveClass(/is-invalid/);
        const error = page.locator('.qa_condition_value_error');
        await expect(error).toBeVisible();
        await expect(error).toContainText('1000');
        await expect(
          page.locator('.qa_condition_value_range_hint')
        ).toHaveCount(0);
      });

      test('marks a value below the minimum as invalid', async ({ page }) => {
        const valueInput = await addRangeCondition(page);

        await valueInput.fill('-1');

        await expect(valueInput).toHaveClass(/is-invalid/);
        await expect(page.locator('.qa_condition_value_error')).toBeVisible();
      });

      test('accepts a value inside the range and restores the hint', async ({
        page,
      }) => {
        const valueInput = await addRangeCondition(page);

        await valueInput.fill('1002');
        await expect(valueInput).toHaveClass(/is-invalid/);

        await valueInput.fill('500');

        await expect(valueInput).not.toHaveClass(/is-invalid/);
        await expect(page.locator('.qa_condition_value_error')).toHaveCount(0);
        await expect(
          page.locator('.qa_condition_value_range_hint')
        ).toBeVisible();
      });

      test('blocks verification while a value is out of range', async ({
        page,
      }) => {
        await page.locator('.qa_filter_name_input').fill('Range Filter');
        await page
          .locator('.qa_filter_description_input')
          .fill('Range Description');

        const valueInput = await addRangeCondition(page);

        const cpsBadge = sourceBadge(page, 'CPS');
        await cpsBadge.click();

        const searchInput = page.locator('.qa_search_attributes_input input');
        await searchInput.fill('nRCellDUId');
        await searchInput.press('Enter');

        const addButtonCps = page
          .locator('.qa_add_attribute_card_button')
          .first();
        await expect(addButtonCps).toBeVisible();
        await addButtonCps.click();

        await page
          .locator('.qa_condition_value_input')
          .nth(1)
          .fill('cps-value');

        await valueInput.fill('1002');
        await expect(page.locator('.qa_execute_button')).toBeDisabled();

        await valueInput.fill('500');
        await expect(page.locator('.qa_execute_button')).toBeEnabled();
      });

      test('shows no range hint for a string attribute', async ({ page }) => {
        const searchInput = page.locator('.qa_search_attributes_input input');
        await searchInput.fill('node');
        await searchInput.press('Enter');

        const card = page
          .locator('.qa_attribute_card')
          .filter({ hasText: 'node.equipType' });
        await expect(card).toBeVisible();
        await card.locator('.qa_add_attribute_card_button').click();

        await expect(page.locator('.qa_condition_value_input')).toBeVisible();
        await expect(
          page.locator('.qa_condition_value_range_hint')
        ).toHaveCount(0);
      });

      test('validates an attribute that only defines a minimum', async ({
        page,
      }) => {
        // node.cell.height carries rangeMin without rangeMax
        const searchInput = page.locator('.qa_search_attributes_input input');
        await searchInput.fill('node');
        await searchInput.press('Enter');

        const card = page
          .locator('.qa_attribute_card')
          .filter({ hasText: 'node.cell.height' });
        await expect(card).toBeVisible();
        await card.locator('.qa_add_attribute_card_button').click();

        const rangeHint = page.locator('.qa_condition_value_range_hint');
        await expect(rangeHint).toBeVisible();
        await expect(rangeHint).toContainText('0');

        const valueInput = page.locator('.qa_condition_value_input').first();
        await valueInput.fill('-5');
        await expect(valueInput).toHaveClass(/is-invalid/);

        // Without an upper bound a large value stays valid
        await valueInput.fill('999999');
        await expect(valueInput).not.toHaveClass(/is-invalid/);
      });

      test('hint and error message keep the same distance to the input', async ({
        page,
      }) => {
        const valueInput = await addRangeCondition(page);

        const gapBelowInput = (selector: string) =>
          page.evaluate(sel => {
            const message = document.querySelector(sel);
            const wrapper = message?.closest('.condition-value-wrapper');
            const input = wrapper?.querySelector('input');
            if (!message || !input) {
              return null;
            }
            return Math.round(
              message.getBoundingClientRect().top -
                input.getBoundingClientRect().bottom
            );
          }, selector);

        await expect(
          page.locator('.qa_condition_value_range_hint')
        ).toBeVisible();
        const hintGap = await gapBelowInput('.qa_condition_value_range_hint');

        await valueInput.fill('1002');
        await expect(page.locator('.qa_condition_value_error')).toBeVisible();
        const errorGap = await gapBelowInput('.qa_condition_value_error');

        expect(hintGap).not.toBeNull();
        expect(hintGap).toBe(errorGap);
      });

      test('hint and error message share the same typography', async ({
        page,
      }) => {
        const valueInput = await addRangeCondition(page);
        const metricsOf = (sel: string) =>
          page.evaluate(s => {
            const el = document.querySelector(s);
            if (!el) return null;
            const cs = getComputedStyle(el);
            return `${cs.fontSize}/${cs.lineHeight}/${cs.padding}/${cs.marginTop}`;
          }, sel);

        await expect(
          page.locator('.qa_condition_value_range_hint')
        ).toBeVisible();
        const hintMetrics = await metricsOf('.qa_condition_value_range_hint');

        await valueInput.fill('1002');
        await expect(page.locator('.qa_condition_value_error')).toBeVisible();
        const errorMetrics = await metricsOf('.qa_condition_value_error');

        // telekom-styles pads .invalid-feedback; only the 4px top offset may remain
        expect(errorMetrics).toContain('4px 0px 0px');
        expect(hintMetrics).toBe(errorMetrics);
      });

      test('value input shows a focus ring only for keyboard focus', async ({
        page,
      }) => {
        const valueInput = await addRangeCondition(page);
        const boxShadow = () =>
          valueInput.evaluate(el => getComputedStyle(el).boxShadow);

        await valueInput.click();
        await expect(valueInput).toBeFocused();
        expect(await boxShadow()).toBe('none');

        // Leave and re-enter the field with the keyboard
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(valueInput).toBeFocused();
        expect(await boxShadow()).not.toBe('none');
      });

      test('the other text inputs on the page behave the same way', async ({
        page,
      }) => {
        const nameInput = page.locator('.qa_filter_name_input');
        const boxShadow = () =>
          nameInput.evaluate(el => getComputedStyle(el).boxShadow);

        await nameInput.click();
        await expect(nameInput).toBeFocused();
        expect(await boxShadow()).toBe('none');

        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await expect(nameInput).toBeFocused();
        expect(await boxShadow()).not.toBe('none');
      });

      test('checkboxes keep their focus ring on click', async ({ page }) => {
        await addRangeCondition(page);

        const checkbox = page
          .locator('.qa_conditions_table tbody input[type="checkbox"]')
          .first();
        await checkbox.click();
        await expect(checkbox).toBeFocused();

        expect(
          await checkbox.evaluate(el => getComputedStyle(el).boxShadow)
        ).not.toBe('none');
      });
    });

    test.describe('attribute with a value list and pattern operators', () => {
      const addSwVersionCondition = async (page: Page) => {
        const searchInput = page.locator('.qa_search_attributes_input input');
        await searchInput.fill('node');
        await searchInput.press('Enter');

        const card = page
          .locator('.qa_attribute_card')
          .filter({ hasText: 'node.swVersion' });
        await expect(card).toBeVisible();
        await card.locator('.qa_add_attribute_card_button').click();
      };

      test('offers the value list for the = operator', async ({ page }) => {
        await addSwVersionCondition(page);

        const valueSelect = page.locator('.qa_condition_value_select');
        await expect(valueSelect).toBeVisible();
        await expect(valueSelect.locator('option:not([disabled])')).toHaveText([
          '22.1.0',
          '22.2.0',
          '23.1.0',
        ]);
        await expect(page.locator('.qa_condition_value_input')).toHaveCount(0);
      });

      for (const operator of ['STARTSWITH', 'REGEX']) {
        test(`accepts a free-text pattern for ${operator}`, async ({
          page,
        }) => {
          await addSwVersionCondition(page);

          await page
            .locator('.qa_condition_operator_select')
            .selectOption(operator);

          await expect(page.locator('.qa_condition_value_select')).toHaveCount(
            0
          );
          const valueInput = page.locator('.qa_condition_value_input');
          await valueInput.fill('22.');
          await expect(valueInput).toHaveValue('22.');
          await expect(valueInput).not.toHaveClass(/is-invalid/);
        });
      }

      test('requires a listed value again when switching back to =', async ({
        page,
      }) => {
        await addSwVersionCondition(page);
        const operatorSelect = page.locator('.qa_condition_operator_select');

        await operatorSelect.selectOption('STARTSWITH');
        await page.locator('.qa_condition_value_input').fill('22.');
        await operatorSelect.selectOption('=');

        await expect(page.locator('.qa_condition_value_select')).toHaveClass(
          /is-invalid/
        );
        await expect(page.locator('.qa_condition_value_error')).toBeVisible();
      });
    });
  }
);
