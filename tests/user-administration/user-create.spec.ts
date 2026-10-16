/*
 * Copyright (c) 2025. Deutsche Telekom AG
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

test.beforeEach('Open user administration', async ({ page }) => {
  await page.goto('/user-administration/create');
});

test.describe('User creation', () => {
  test('Available roles are visible', async ({ page }) => {
    await expect(page.getByTestId('available_roles_container')).toBeVisible();
    await expect(page.getByText('portal_admin')).toBeVisible();
    await expect(page.getByText('portal_operator')).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'portal_admin' })
    ).toBeVisible();
    await expect(
      page.getByRole('checkbox', { name: 'portal_operator' })
    ).toBeVisible();
  });

  test('Roles can be checked and unchecked', async ({ page }) => {
    const availableRolesContainer = page.getByTestId(
      'available_roles_container'
    );

    const assignedRolesContainer = page.getByTestId('assigned_roles_container');

    await expect(availableRolesContainer).toBeVisible({ timeout: 10000 });
    await expect(assignedRolesContainer).toBeVisible();

    // Initial state
    await expect(
      availableRolesContainer.getByRole('checkbox', {
        name: 'portal_admin',
      })
    ).toHaveCount(1);

    await expect(
      assignedRolesContainer.getByRole('checkbox', {
        name: 'portal_admin',
      })
    ).toHaveCount(0);

    // Move role to Assigned Roles
    await availableRolesContainer
      .getByRole('checkbox', { name: 'portal_admin' })
      .click();

    await expect(
      availableRolesContainer.getByRole('checkbox', {
        name: 'portal_admin',
      })
    ).toHaveCount(0);

    await expect(
      assignedRolesContainer.getByRole('checkbox', {
        name: 'portal_admin',
      })
    ).toHaveCount(1, { timeout: 10000 });

    // Move role back to Available Roles
    await assignedRolesContainer
      .getByRole('checkbox', { name: 'portal_admin' })
      .click();

    await expect(
      availableRolesContainer.getByRole('checkbox', {
        name: 'portal_admin',
      })
    ).toHaveCount(1, { timeout: 10000 });

    await expect(
      assignedRolesContainer.getByRole('checkbox', {
        name: 'portal_admin',
      })
    ).toHaveCount(0);
  });

  test('User can be created', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Create User' })
    ).toBeVisible({ timeout: 10000 });

    // await page.getByRole('textbox', { name: 'Username' }).click();
    await page.getByRole('textbox', { name: 'Username' }).fill('testuser');
    await page.getByRole('textbox', { name: 'Email' }).click();
    await page
      .getByRole('textbox', { name: 'Email' })
      .fill('test.user@onap.org');
    await page.getByRole('textbox', { name: 'Email' }).press('Tab');
    await page.getByRole('textbox', { name: 'First Name' }).fill('test');
    await page.getByRole('textbox', { name: 'First Name' }).press('Tab');
    await page.getByRole('textbox', { name: 'Last Name' }).fill('user');

    // TODO: User creation is not fully working yet as it is not redirecting to the list page upon saving
    await page.getByRole('button', { name: 'Save' }).click();
    // await expect(page.locator('table#ng-data-table')).toBeVisible();
    await expect(page.getByText('User successfully created.')).toBeVisible({
      timeout: 10000,
    });
  });
});
