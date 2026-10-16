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
import { requirementMetCount } from './ran-filter.constants';
import { RAN_FILTER_NODES_LIMIT } from '../../../src/app/modules/ran-filter/model/ran-filter.model';

const IMPACT_MARKER = '"resultCount": 3';
const NODES_MARKER = '"nodeName": "Bonn-NR-001"';

const resultPanel = (page: Page) => page.locator('.qa_execute_result_panel');
const resultJson = (page: Page) => page.locator('.execute-result-json');
const showNodes = (page: Page) =>
  page.getByRole('checkbox', {
    name: `Show matching nodes (up to ${RAN_FILTER_NODES_LIMIT})`,
    exact: true,
  });
const requirements = (page: Page) => page.locator('.qa_filter_requirements');

/** Adds the first Topology attribute of the default stub and fills its value. */
const addTopologyCondition = async (page: Page) => {
  const searchInput = page.locator('.qa_search_attributes_input input');
  await searchInput.fill('node');
  await searchInput.press('Enter');

  const addButton = page.locator('.qa_add_attribute_card_button').first();
  await expect(addButton).toBeVisible();
  await addButton.click();

  await page.locator('.qa_condition_value_input').first().fill('test-value');
};

/**
 * Two responses are needed — impact-only vs. with node data — and the whole
 * point of these tests is *how many* times each is asked for, so the single
 * catch-all WireMock mapping cannot serve them.
 */
const stubVerify = async (page: Page, endpoint = 'test') => {
  const calls: boolean[] = [];
  const limits: (number | undefined)[] = [];

  await page.route(`**/api/ran-filters/${endpoint}`, async route => {
    const request = route.request().postDataJSON() as {
      impactOnly?: boolean;
      limit?: number;
    };
    const impactOnly = request.impactOnly ?? true;
    calls.push(impactOnly);
    limits.push(request.limit);

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        payload: impactOnly
          ? { resultCount: 3 }
          : {
              resultCount: 3,
              nodes: [{ nodeId: 'node-001', nodeName: 'Bonn-NR-001' }],
            },
      }),
    });
  });

  return {
    /** Every impactOnly flag the UI sent, in order. */
    calls,
    limits,
    impactOnlyCount: () => calls.filter(Boolean).length,
    withNodesCount: () => calls.filter(c => !c).length,
  };
};

test.describe('RAN Filter verify — show nodes', { tag: '@mvpOperator' }, () => {
  test.use({ locale: 'en' });

  test('verifies impact-only and reveals nodes on demand', async ({ page }) => {
    const verify = await stubVerify(page);
    await page.goto('/ran-filter/create');
    await addTopologyCondition(page);

    await page.locator('.qa_verify_button').click();
    await expect(resultPanel(page)).toBeVisible();
    await expect(resultJson(page)).toContainText(IMPACT_MARKER);
    await expect(resultJson(page)).not.toContainText(NODES_MARKER);
    await expect(showNodes(page)).not.toBeChecked();

    await expect(showNodes(page)).toBeVisible();
    await showNodes(page).focus();
    await showNodes(page).press('Space');

    await expect(resultJson(page)).toContainText(NODES_MARKER);
    await expect(showNodes(page)).toBeChecked();
    expect(verify.calls).toEqual([true, false]);
    expect(verify.limits).toEqual([
      RAN_FILTER_NODES_LIMIT,
      RAN_FILTER_NODES_LIMIT,
    ]);
  });

  test('executes with the same node limit shown in the checkbox label', async ({
    page,
  }) => {
    const execution = await stubVerify(page, 'execute');
    await page.goto('/ran-filter');
    const executeButton = page.getByRole('button', {
      name: 'Preview result of filter Filter Name 1 (not stored in S3)',
      exact: true,
    });
    await expect(executeButton).toBeVisible();
    await executeButton.click();

    await expect(resultPanel(page)).toBeVisible();
    await expect(showNodes(page)).toBeVisible();
    await showNodes(page).check();

    await expect(resultJson(page)).toContainText(NODES_MARKER);
    await expect(showNodes(page)).toBeChecked();
    expect(execution.calls).toEqual([true, false]);
    expect(execution.limits).toEqual([
      RAN_FILTER_NODES_LIMIT,
      RAN_FILTER_NODES_LIMIT,
    ]);
  });

  test('switching the toggle off and on again sends no further request', async ({
    page,
  }) => {
    const verify = await stubVerify(page);
    await page.goto('/ran-filter/create');
    await addTopologyCondition(page);

    await page.locator('.qa_verify_button').click();
    await expect(resultPanel(page)).toBeVisible();
    await showNodes(page).check();
    await expect(resultJson(page)).toContainText(NODES_MARKER);

    await showNodes(page).uncheck();
    await expect(resultJson(page)).not.toContainText(NODES_MARKER);

    await showNodes(page).check();
    await expect(resultJson(page)).toContainText(NODES_MARKER);

    // One verify run plus one node fetch — the rest came from the cache.
    expect(verify.calls).toEqual([true, false]);
  });

  test('toggling keeps the filter verified and raises no second alert', async ({
    page,
  }) => {
    const verify = await stubVerify(page);
    await page.goto('/ran-filter/create');
    await addTopologyCondition(page);

    await page.locator('.qa_verify_button').click();
    await expect(resultPanel(page)).toBeVisible();
    await expect(requirements(page)).toContainText(requirementMetCount(3, 3));

    await showNodes(page).check();
    await expect(resultJson(page)).toContainText(NODES_MARKER);

    // A view switch must not revoke the verification the checklist reports.
    await expect(requirements(page)).toContainText(requirementMetCount(3, 3));
    await expect(page.locator('.qa_execute_result_close')).toBeEnabled();
    expect(verify.withNodesCount()).toBe(1);
  });

  test('reopening the result starts impact-only again', async ({ page }) => {
    const verify = await stubVerify(page);
    await page.goto('/ran-filter/create');
    await addTopologyCondition(page);

    await page.locator('.qa_verify_button').click();
    await expect(resultPanel(page)).toBeVisible();
    await showNodes(page).check();
    await expect(resultJson(page)).toContainText(NODES_MARKER);

    await page.locator('.qa_execute_result_close').click();
    await expect(resultPanel(page)).toHaveCount(0);

    await page.locator('.qa_verify_button').click();
    await expect(resultPanel(page)).toBeVisible();

    // The checkbox and the payload have to agree — this is what regressed.
    await expect(showNodes(page)).not.toBeChecked();
    await expect(resultJson(page)).not.toContainText(NODES_MARKER);
    expect(verify.calls).toEqual([true, false, true]);
  });
});
