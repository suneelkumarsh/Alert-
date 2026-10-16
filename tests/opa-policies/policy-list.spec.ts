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
import { PolicyListPage } from './policy-list.page';

/**
 * The version and the status of a row are resolved by two independent per-row fan-outs
 * (`/opa-policies/{file}` for the version, `/policies/{file}` + `/policy-status` for the
 * status), so a row rendering its neighbour's value is the failure mode worth catching. The
 * fixture therefore gives every row a different version *and* a different (version, status)
 * pairing — with identical values a mix-up is invisible.
 *
 * `tnap.slice_feasibility` is deliberately asymmetric: it carries no
 * `metadata.policyVersion` (so the version column has to fall back to `-`) while its TOSCA
 * content still carries `version: 4.2.0`, which is what the status lookup must use.
 */
const POLICIES = [
  {
    name: 'tnap.tmap_offset',
    version: '1.0.5',
    statusText: 'Policy deployed',
    statusClass: 'qa_status_deployed',
  },
  {
    name: 'tnap.slice_capacity_check',
    version: '2.1.0',
    statusText: 'Deployment in progress',
    statusClass: 'qa_status_not_found',
  },
  {
    name: 'tnap.cell_restriction',
    version: '3.0.1',
    statusText: 'Deployment in progress',
    statusClass: 'qa_status_not_found',
  },
  {
    name: 'tnap.slice_feasibility',
    version: '-',
    statusText: 'Policy deployed',
    statusClass: 'qa_status_deployed',
  },
];

const GITLAB_MAIN_BRANCH_URL =
  'https://gitlab.devops.telekom.de/tnap/development/ran-do1-policies-templates/ran-do-policies/-/tree/main';

test.describe('OPA Policy List Page', () => {
  test('Policy list page is visible and contains header columns', async ({
    page,
  }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    await expect(
      page.getByRole('columnheader', { name: /name/i })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: /version/i })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: /status/i })
    ).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: /actions/i })
    ).toBeVisible();
  });

  test('Only allow-listed policy files are listed, without the file suffix', async ({
    page,
  }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    await expect(policyListPage.policyTable.dataRows).toHaveCount(
      POLICIES.length
    );

    for (const policy of POLICIES) {
      // `rowFor` matches the name cell exactly, so this also asserts that the
      // `_opa_policy.yml` suffix is stripped for display.
      await expect(policyListPage.rowFor(policy.name)).toHaveCount(1);
    }

    // The backend also returns a README, a directory and a policy file that is not on the
    // allow list — none of them is a policy the user may open.
    for (const hidden of ['README', 'archive', 'not_allowed', 'opa_policy']) {
      await expect(
        policyListPage.policyNames.filter({ hasText: hidden })
      ).toHaveCount(0);
    }
  });

  test('Each policy shows its own version, falling back to a dash', async ({
    page,
  }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    for (const policy of POLICIES) {
      await expect(policyListPage.versionCellFor(policy.name)).toHaveText(
        policy.version
      );
    }
  });

  test('Each policy shows its own deployment status', async ({ page }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    for (const policy of POLICIES) {
      await expect(
        policyListPage
          .statusCellFor(policy.name)
          .locator(`.${policy.statusClass}`)
      ).toHaveText(policy.statusText);
    }

    // Every failure in the three-call status chain is swallowed into UNKNOWN, so a single
    // missing response leaves the column looking populated. Zero unknown rows is what
    // proves the whole chain actually ran for every policy.
    await expect(page.locator('.qa_status_unknown')).toHaveCount(0);
  });

  test('A policy whose content cannot be interpreted falls back to an unknown status', async ({
    page,
  }) => {
    await page.route(
      '**/api/policies/tnap.tmap_offset_opa_policy.yml?*',
      route =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            name: 'tnap.tmap_offset_opa_policy.yml',
            path: 'tnap.tmap_offset_opa_policy.yml',
            content: 'topology_template:\n  policies: []\n',
          }),
        })
    );

    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    await expect(
      policyListPage
        .statusCellFor('tnap.tmap_offset')
        .locator('.qa_status_unknown')
    ).toHaveText('Policy status unknown');

    // One unresolvable policy must not take the other rows down with it.
    await expect(
      policyListPage
        .statusCellFor('tnap.slice_feasibility')
        .locator('.qa_status_deployed')
    ).toBeVisible();
  });

  test('No error is raised while the list loads', async ({ page }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    await expect(policyListPage.policyTable.dataRows).toHaveCount(
      POLICIES.length
    );
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test(
    'Search input is visible and functional',
    { tag: '@smokeTest' },
    async ({ page }) => {
      const policyListPage = new PolicyListPage(page);
      await policyListPage.goto();

      await expect(policyListPage.searchInput).toBeVisible();

      await policyListPage.searchInput.fill('tmap');
      await expect(policyListPage.policyTable.rows).toHaveCount(1);
      await expect(page.locator('.qa_name_value').first()).toBeVisible();
    }
  );

  test('Searching narrows the list down to the matching policies', async ({
    page,
  }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();
    await expect(policyListPage.policyTable.dataRows).toHaveCount(
      POLICIES.length
    );

    await policyListPage.searchInput.fill('slice');
    await expect(policyListPage.policyTable.dataRows).toHaveCount(2);
    await expect(
      policyListPage.rowFor('tnap.slice_capacity_check')
    ).toHaveCount(1);
    await expect(policyListPage.rowFor('tnap.tmap_offset')).toHaveCount(0);

    await policyListPage.searchInput.fill('tmap');
    await expect(policyListPage.policyTable.dataRows).toHaveCount(1);
    await expect(policyListPage.rowFor('tnap.tmap_offset')).toHaveCount(1);

    await policyListPage.clearSearchButton.click();
    await expect(policyListPage.searchInput).toHaveValue('');
    await expect(policyListPage.policyTable.dataRows).toHaveCount(
      POLICIES.length
    );
  });

  test('A search term is taken from the URL on load', async ({ page }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto('slice');

    await expect(policyListPage.searchInput).toHaveValue('slice');
    await expect(policyListPage.policyTable.dataRows).toHaveCount(2);
  });

  test('A search without matches shows the filter-specific message', async ({
    page,
  }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    await policyListPage.searchInput.fill('no-such-policy');

    await expect(policyListPage.policyTable.dataRows).toHaveCount(0);
    await expect(policyListPage.emptyMessage).toContainText(
      'No match to the given filter criteria.'
    );
  });

  test('An empty policy repository shows the no-data message', async ({
    page,
  }) => {
    await page.route('**/api/policies?*', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0 }),
      })
    );

    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    await expect(policyListPage.policyTable.dataRows).toHaveCount(0);
    await expect(policyListPage.emptyMessage).toContainText(
      'No data available.'
    );
  });

  test('View and Edit buttons are exposed with an accessible name', async ({
    page,
  }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    for (const policy of POLICIES) {
      await expect(policyListPage.viewButtonFor(policy.name)).toHaveAttribute(
        'aria-label',
        'View Policy'
      );
      await expect(policyListPage.editButtonFor(policy.name)).toHaveAttribute(
        'aria-label',
        'Edit Policy'
      );
    }
  });

  test('Viewing a policy opens it read-only', async ({ page }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    await Promise.all([
      page.waitForURL(/mode=view/),
      policyListPage.viewButtonFor('tnap.tmap_offset').click(),
    ]);

    await expect(page).toHaveURL(/mode=view/);
    await expect(page).toHaveURL(
      /policyPath=tnap\.tmap_offset_opa_policy\.yml/
    );
  });

  test('Editing a policy opens it in edit mode', async ({ page }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    await Promise.all([
      page.waitForURL(/mode=edit/),
      policyListPage.editButtonFor('tnap.tmap_offset').click(),
    ]);

    await expect(page).toHaveURL(/mode=edit/);
    await expect(page.getByText('This is a Readonly Policy.')).toHaveCount(0);
  });

  test('A policy whose script is not editable stays read-only when edited', async ({
    page,
  }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    // `tnap.cell_restriction` is served with `script-editable: false`, so the Edit button
    // must downgrade to the read-only view instead of opening the editor.
    await policyListPage.editButtonFor('tnap.cell_restriction').click();

    await expect(page).toHaveURL(/policyPath=/);
    await expect(page.getByText('This is a Readonly Policy.')).toBeVisible();
  });

  test('A policy that fails to load raises an alert and keeps the list open', async ({
    page,
  }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();
    await expect(policyListPage.policyTable.dataRows).toHaveCount(
      POLICIES.length
    );

    // Routed only after the list has rendered, so the failure belongs to the click and not
    // to the version column, which reads the same endpoint.
    await page.route(
      '**/api/opa-policies/tnap.tmap_offset_opa_policy.yml?*',
      route =>
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ message: 'policy could not be read' }),
        })
    );

    await policyListPage.viewButtonFor('tnap.tmap_offset').click();

    // Only the presence of the alert is asserted: the component asks for
    // `policyBuilder.errors.loadPolicyFailed`, which does not exist in either translation
    // file, so the rendered text is currently the raw key.
    await expect(page.getByRole('alert').first()).toBeVisible();
    await expect(policyListPage.policyTable.dataRows).toHaveCount(
      POLICIES.length
    );
  });

  test('The GitLab link points at the default branch and opens in a new tab', async ({
    page,
  }) => {
    const policyListPage = new PolicyListPage(page);
    await policyListPage.goto();

    await expect(policyListPage.mainBranchLink).toHaveAttribute(
      'href',
      GITLAB_MAIN_BRANCH_URL
    );
    await expect(policyListPage.mainBranchLink).toHaveAttribute(
      'target',
      '_blank'
    );
    await expect(policyListPage.mainBranchLink).toHaveAttribute(
      'rel',
      'noopener noreferrer'
    );
    await expect(policyListPage.mainBranchLink).toHaveAttribute(
      'aria-label',
      'Open GitLab main branch in an external page in a new tab'
    );
  });

  test('Policy list uses tnap data table', async ({ page }) => {
    const policyListPage = new PolicyListPage(page);

    await policyListPage.goto();

    await expect(page.locator('tnap-data-table')).toBeVisible();
  });
});
