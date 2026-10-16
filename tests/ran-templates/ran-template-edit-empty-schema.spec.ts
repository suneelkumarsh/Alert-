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

const FILE_NAME = 'empty-schema-template.jinja';
const TEMPLATE_SET = 'Common/E2EDemo';
const FILE_PATH = `${TEMPLATE_SET}/${FILE_NAME}`;
const DRAFT_REF = 'draft-e2e-empty-schema';
const META_CONTENT =
  '{#\nname: empty-schema-template\nvendor: Ericsson\nrelease: 1.0\nversion: 1.0\nvendorModelNumber: BBU\ndescription: Empty schema demo\n#}\n{# template html response #}\n';

const editUrl = (): string =>
  `/ran-template/edit?mode=edit&templateSet=${encodeURIComponent(TEMPLATE_SET)}&path=${encodeURIComponent(FILE_PATH)}&ref=${DRAFT_REF}&file=${FILE_NAME}`;

test.describe('Ran Template edit - empty schema panel', () => {
  test('shows the toggle and opens an empty schema tree without hiding template content', async ({
    page,
  }) => {
    await page.route(
      '**/service-design-and-creation/taskworkflow/rantemplateresources*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            resources: [
              {
                vendorName: 'Ericsson',
                resourceVendorModelNumber: 'BBU',
                vendorRelease: '1.0',
              },
            ],
          }),
        });
      }
    );

    await page.route('**/ran-templates-source-draft*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ name: 'main', isDefault: true }),
      });
    });

    await page.route('**/ran-templates/*/jsonschema*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ranTemplateJsonSchema: {} }),
      });
    });

    await page.route(
      '**/service-design-and-creation/taskworkflow/resourcebyname*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            version: '1.0',
            distributionStatus: 'DISTRIBUTION_NOT_APPROVED',
          }),
        });
      }
    );

    // Production builds encode nested path separators as %2F.
    await page.route(
      url => url.pathname.includes(FILE_NAME),
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: META_CONTENT }),
        });
      }
    );

    await page.goto(editUrl());

    const schemaToggle = page.locator('.qa_schema_panel_toggle');
    await expect(schemaToggle).toBeVisible();
    await expect(page.locator('.schema-tree-panel')).toBeVisible();
    await expect(page.locator('.qa_nav_tabs_branches')).toBeVisible();
    await expect(
      page.locator('.cm-content[contenteditable="true"]').first()
    ).toContainText('template html response');

    await schemaToggle.click();

    await expect(page.locator('.schema-tree-panel')).toBeHidden();
    await expect(schemaToggle).toBeVisible();
  });
});
