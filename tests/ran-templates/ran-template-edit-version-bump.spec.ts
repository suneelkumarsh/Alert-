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

const FILE_NAME = 'demo-template.jinja';
const TEMPLATE_SET = 'Common/E2EDemo';
const FILE_PATH = `${TEMPLATE_SET}/${FILE_NAME}`;

const META_CONTENT =
  '{#\nname: demo_template\nvendor: Ericsson\nrelease: 1.0\nversion: 1.0\nvendorModelNumber: BBU\ndescription: Version bump demo\n#}\n{@ demo }\n';

const RAN_TEMPLATE_RESOURCES = {
  resources: [
    {
      vendorName: 'Ericsson',
      resourceVendorModelNumber: 'BBU',
      vendorRelease: '1.0',
    },
  ],
};

const editUrl = (ref: string): string =>
  `/ran-template/edit?mode=edit&templateSet=${encodeURIComponent(TEMPLATE_SET)}&path=${encodeURIComponent(FILE_PATH)}&ref=${ref}&file=${FILE_NAME}`;

const stubCommonRoutes = async (
  page: import('@playwright/test').Page
): Promise<void> => {
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
      body: JSON.stringify({
        ranTemplateJsonSchema: { type: 'object', properties: {} },
      }),
    });
  });
};

test.describe('Ran Template edit - version bump on save/deploy', () => {
  test('bumps to the next minor version after saving a draft', async ({
    page,
  }) => {
    const draftRef = 'draft-e2e-version-1';
    // Mirrors RanTemplateEditComponent.save()'s minor bump (1.0 -> 1.1);
    // the resourcebyname stub reports it back as if the backend persisted it.
    let backendVersion = '1.0';
    let templateContent = META_CONTENT;

    await stubCommonRoutes(page);

    await page.route(
      '**/service-design-and-creation/taskworkflow/resourcebyname*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            version: backendVersion,
            distributionStatus: 'DISTRIBUTION_NOT_APPROVED',
          }),
        });
      }
    );

    // pathname.includes (not endsWith) because a prod build encodeURIComponent's
    // the whole path, turning '/' into '%2F' so the path is one opaque segment.
    await page.route(
      url => url.pathname.includes(FILE_NAME),
      async route => {
        if (route.request().method() === 'PUT') {
          backendVersion = '1.1';
          templateContent = String(route.request().postDataJSON()?.content);

          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([
              {
                name: FILE_NAME,
                draftName: draftRef,
                response: {
                  status: 'OK',
                },
              },
            ]),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: templateContent }),
        });
      }
    );

    await page.goto(editUrl(draftRef));

    await expect(page.locator('.qa_version_badge')).toContainText(
      'Version: 1.0'
    );

    await page.locator('#description').fill('Version bump demo - edited');

    await page.locator('.qa_button_save').click();
    await page.locator('.qa_apply_button').click();

    await expect(page.locator('.qa_version_badge')).toContainText(
      'Version: 1.1'
    );
  });

  test('bumps to the next major version after deploying', async ({ page }) => {
    const draftRef = 'draft-e2e-version-2';
    // Deploy computes the major bump (1.0 -> 2.0) from the CURRENT
    // resourceVersion before any network call, so the stub only needs to
    // reflect that bump once the deploy request lands.
    let backendVersion = '1.0';
    let templateContent = META_CONTENT;

    await stubCommonRoutes(page);

    await page.route(
      '**/service-design-and-creation/taskworkflow/resourcebyname*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            version: backendVersion,
            distributionStatus: 'DISTRIBUTED',
          }),
        });
      }
    );

    // Every /ran-templates/{path}* call is served from this one handler on purpose.
    // The validate URL is '/ran-templates/{path}/validate', so it also matches this
    // broader pattern: a second, separate '**/*validate*' route would be ambiguous and
    // could let the validate POST be answered with the GET's FileContent body instead.
    //
    // pathname.includes (not endsWith) because a prod build encodeURIComponent's
    // the whole path, turning '/' into '%2F' so the path is one opaque segment.
    await page.route(
      url => url.pathname.includes(FILE_NAME),
      async route => {
        const request = route.request();

        // TemplateValidationResponse - a bare object, not a list. deploy() reads
        // response.status through allTemplatesValid(); any other shape reads as
        // "invalid", which rolls resourceVersion back to its pre-bump value.
        if (request.url().includes('/validate')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ status: 'OK' }),
          });
          return;
        }

        // Draft - supplies the draftName that deploy() passes to the deploy call.
        if (request.method() === 'PUT') {
          backendVersion = '2.0';
          templateContent = String(request.postDataJSON()?.content);
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              name: draftRef,
              url: '',
              isDefault: false,
            }),
          });
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ content: templateContent }),
        });
      }
    );

    await page.route('**/ran-template-drafts/*/deploy*', async route => {
      backendVersion = '2.0';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: {
            status: 'OK',
          },
        }),
      });
    });

    await page.goto(editUrl(draftRef));

    await expect(page.locator('.qa_version_badge')).toContainText(
      'Version: 1.0'
    );

    await page.locator('#description').fill('Version bump demo - edited');

    await page.locator('.qa_button_deploy').click();
    await page.locator('.qa_apply_button').click();

    await expect(page.locator('.qa_version_badge')).toContainText(
      'Version: 2.0'
    );
  });

  test('enables deploy button when draft changes exist', async ({ page }) => {
    await stubCommonRoutes(page);

    await page.route(
      '**/service-design-and-creation/taskworkflow/resourcebyname*',
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            version: '1.0',
            distributionStatus: 'DISTRIBUTED',
          }),
        });
      }
    );

    await page.route(
      url => url.pathname.includes(FILE_NAME),
      async route => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            content: META_CONTENT,
          }),
        });
      }
    );

    await page.goto(editUrl('draft-e2e-enable'));

    const deployButton = page.locator('.qa_button_deploy');

    await expect(deployButton).toBeDisabled();

    await page.locator('#description').fill('Version bump demo - modified');

    await expect(deployButton).toBeEnabled();
  });
});
