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

const RESOURCES = {
  resources: [
    {
      vendorName: 'Ericsson',
      resourceVendorModelNumber: 'BBU',
      vendorRelease: '1.0',
    },
  ],
};

const ADD_URL =
  '/ran-template/edit?templateSet=Common%2FE2EAddValidation&mode=add';

test.describe('Ran Template add - deploy without CDS validation', () => {
  test('saves and deploys the new file without CDS validation', async ({
    page,
  }) => {
    let deployRequests = 0;
    let validationRequests = 0;
    const requestSequence: string[] = [];

    await page.route(
      '**/service-design-and-creation/taskworkflow/rantemplateresources*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(RESOURCES),
        });
      }
    );

    await page.route(
      '**/service-design-and-creation/taskworkflow/validate-name*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(true),
        });
      }
    );

    await page.route('**/ran-templates/*/jsonschema*', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ranTemplateJsonSchema: {} }),
      });
    });

    await page.route(
      url =>
        url.pathname.endsWith('/ran-templates-manager/file') &&
        url.searchParams.has('path'),
      async route => {
        expect(route.request().method()).toBe('POST');
        requestSequence.push('create');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ name: 'draft-e2e-add-validation' }),
        });
      }
    );

    await page.route(
      url => url.pathname.endsWith('/validate'),
      async route => {
        validationRequests += 1;
        requestSequence.push('validate');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ERROR' }),
        });
      }
    );

    await page.route('**/ran-template-drafts/*/deploy*', async route => {
      deployRequests += 1;
      requestSequence.push('deploy');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      });
    });

    await page.goto(ADD_URL);

    await page.locator('#templateName').fill('base_template');
    await page.locator('#description').fill('Validation failure demo');
    await page.locator('tnap-select.qa_vendor_select select').selectOption({
      label: 'Ericsson',
    });
    await page.locator('tnap-select.qa_model_select select').selectOption({
      label: 'BBU',
    });
    await page.locator('tnap-select.qa_version_select select').selectOption({
      label: '1.0',
    });
    await page.locator('#description').blur();

    const deployButton = page.locator('.qa_button_deploy');
    await expect(deployButton).toBeEnabled();
    await deployButton.click();
    await page.locator('.qa_apply_button').click();

    await expect.poll(() => deployRequests).toBe(1);

    expect(validationRequests).toBe(0);

    expect(requestSequence).toEqual(['create', 'deploy']);
  });
});
