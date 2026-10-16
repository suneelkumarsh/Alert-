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

const RAN_TEMPLATE_RESOURCES = {
  resources: [
    {
      vendorName: 'Ericsson',
      resourceVendorModelNumber: 'BBU',
      vendorRelease: '1.0',
    },
  ],
};

const RAN_TEMPLATE_JSON_SCHEMA = {
  ranTemplateJsonSchema: {
    type: 'object',
    properties: {
      cellId: 'string',
      sector: {
        azimuth: 'number',
        beamwidth: 'number',
      },
    },
  },
};

test.describe('Ran Template edit - schema browser', () => {
  test('populates dropdowns, shows schema tree after selection, and inserts a leaf path into the draft editor', async ({
    page,
  }) => {
    await page.route(
      '**/service-design-and-creation/taskworkflow/rantemplateresources*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(RAN_TEMPLATE_RESOURCES),
        });
      }
    );

    await page.route('**/ran-templates/*/jsonschema*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RAN_TEMPLATE_JSON_SCHEMA),
      });
    });

    await page.goto(
      '/ran-template/edit?templateSet=Common%2FSchemaDemo&mode=add'
    );

    const vendorSelect = page.locator('tnap-select.qa_vendor_select select');
    const modelSelect = page.locator('tnap-select.qa_model_select select');
    // qa_version_select is bound to formData().release (renamed from
    // formData().version), and its label now reads "Release" instead of
    // "Version" - the dropdown still lists vendorRelease values (e.g. "1.0").
    const releaseSelect = page.locator('tnap-select.qa_version_select select');

    await expect(
      page.locator('tnap-select.qa_version_select').getByText('Release')
    ).toBeVisible();

    // Dropdown population from the stubbed resources endpoint.
    await expect(
      vendorSelect.locator('option', { hasText: 'Ericsson' })
    ).toHaveCount(1);
    await expect(modelSelect.locator('option', { hasText: 'BBU' })).toHaveCount(
      1
    );
    await expect(
      releaseSelect.locator('option', { hasText: '1.0' })
    ).toHaveCount(1);

    await vendorSelect.selectOption({ label: 'Ericsson' });
    await modelSelect.selectOption({ label: 'BBU' });
    await releaseSelect.selectOption({ label: '1.0' });

    // Schema tree appears once vendor + model + release form a valid selection.
    const schemaTreePanel = page.locator('.schema-tree-panel');
    await expect(schemaTreePanel).toBeVisible({ timeout: 20_000 });

    const cellIdLeaf = page.getByRole('button', { name: 'cellId' });
    await expect(cellIdLeaf).toBeVisible();

    // Focus the draft editor right before inserting: mousedown on the
    // dropdowns above resets the "was editor last focused" tracking.
    const editor = page.locator('.cm-content[contenteditable="true"]').first();
    await expect(editor).toBeVisible();
    await editor.click();

    await cellIdLeaf.dblclick();

    // Insertion writes the schema leaf's full path (dot notation) into the draft editor content.
    await expect(editor).toContainText('schema.properties.cellId');
  });

  test('filters schema tree and restores it when search is cleared', async ({
    page,
  }) => {
    await page.route(
      '**/service-design-and-creation/taskworkflow/rantemplateresources*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(RAN_TEMPLATE_RESOURCES),
        });
      }
    );

    await page.route('**/ran-templates/*/jsonschema*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(RAN_TEMPLATE_JSON_SCHEMA),
      });
    });

    await page.goto(
      '/ran-template/edit?templateSet=Common%2FSchemaDemo&mode=add'
    );

    await page
      .locator('tnap-select.qa_vendor_select select')
      .selectOption({ label: 'Ericsson' });

    await page
      .locator('tnap-select.qa_model_select select')
      .selectOption({ label: 'BBU' });

    // qa_version_select is bound to formData().release, not formData().version.
    await page
      .locator('tnap-select.qa_version_select select')
      .selectOption({ label: '1.0' });

    const searchInput = page.getByLabel('Search (min. 3 characters)');

    // 'cell' is 4 chars: the component ignores queries shorter than 3.
    await searchInput.fill('cell');

    await expect(page.getByRole('button', { name: 'cellId' })).toBeVisible();
    /*
     * The assertion that makes this test able to fail — verified to fail against a
     * filter-less build. `toBeHidden()` rather than `toHaveCount(0)`: it passes both for a
     * removed node and a present-but-invisible one, so it does not depend on how
     * ng-treeview virtualises a larger fixture.
     */
    await expect(page.getByRole('button', { name: 'sector' })).toBeHidden();

    await searchInput.clear();

    await expect(page.getByRole('button', { name: 'cellId' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'sector' })).toBeVisible();
  });
});
