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

import { test, expect } from '../../fixtures';

test.describe('Tree View- Heading hierarchy', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/treeview?page=1&pageSize=50');
    await expect(
      page.getByText('Select an entry on the left to view details here.')
    ).toBeVisible();
  });

  test('must have a visible H1', async ({ page }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: 'Tree View' })
    ).toBeVisible();

    // The shell's sidebar heading is an h2, so the page's own title is the only h1.
    await expect(page.locator('h1')).toHaveCount(1);
  });

  test('Tree View page - heading hierarchy validation', async ({ page }) => {
    // Select node
    const nodeItem = page
      .locator('.qa_instance_node', { hasText: '73000002' })
      .first();
    await expect(nodeItem).toBeVisible();
    await nodeItem.click();

    // H2 sections
    await expect(
      page.getByRole('heading', { level: 2, name: '73000002' })
    ).toBeVisible();

    // H3 sections
    const generalSections = page.getByRole('heading', {
      level: 3,
      name: 'General',
    });
    await expect(generalSections.first()).toBeVisible();

    // H3 expandable sections
    const idsSections = page.getByRole('heading', {
      level: 3,
      name: 'IDs',
    });
    await expect(idsSections.first()).toBeVisible();
  });

  // show in topology view
  test('should navigate to topology view when clicking "Show in Topology View"', async ({
    page,
  }) => {
    const nodeId = '73000002';
    const nodeItem = page
      .locator('.qa_instance_node', { hasText: nodeId })
      .first();
    await expect(nodeItem).toBeVisible();
    await nodeItem.click();

    await expect(
      page.getByRole('heading', { level: 2, name: nodeId })
    ).toBeVisible();

    const topologyLink = page.getByText('Show in Topology View');

    await expect(topologyLink).toBeVisible();

    await Promise.all([
      page.waitForURL(new RegExp(`/topology/${nodeId}`)),
      topologyLink.click(),
    ]);

    await expect(page).toHaveURL(new RegExp(`/topology/${nodeId}`));
  });
});

// TNAP-30772 AC2.1: the node-view half of the exclusive @if in treeview.component.html. Its RAT
// counterpart lives in rat-view-rbac.mvp.spec.ts, which runs under a different Keycloak user -
// the two files together are the assertion, because either one alone passes for a build that
// renders the wrong tree.
test.describe('Tree View - tree mode selection', () => {
  test('serves the node tree to a user without the RAT permission', async ({
    page,
  }) => {
    await page.goto('/treeview?page=1&pageSize=50');

    // test-admin holds portal_operator but not mvp_operator, so VIEW_RAT_VIEW resolves to denied
    // and the @else branch renders. A permission-name typo in permissions.config.ts also resolves
    // to denied - which is why the count-1 half matters: it fails if the RAT branch ever wins here.
    await expect(page.locator('app-node-view')).toHaveCount(1);
    await expect(page.locator('app-rat-view')).toHaveCount(0);

    // And it is a populated node tree, not an empty shell that happens to be the right component.
    await expect(
      page.locator('.qa_instance_node', { hasText: '73000002' }).first()
    ).toBeVisible();
  });
});
