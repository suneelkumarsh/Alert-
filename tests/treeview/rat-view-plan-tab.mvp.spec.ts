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

import { test, expect, Locator } from '../../fixtures';
import {
  configTableRow,
  deepLinkUrl,
  detailTab,
  expectNoRequests,
  openConfigTable,
  navigateToPlanTabAndEnterEditMode,
  planAttributeInput,
} from './rat-view.helpers';

// TNAP-25354 AC2: planning attributes come from AAI's *planning* self-link, held apart from the
// live configuration. The Plan tab is gated on showPlanTab() = VIEW_RAT_VIEW && aaiType in
// {service-instance, pnf, cell}, so it exists only in a RAT session - which is why it had no e2e
// coverage at all until this spec: the one pre-existing local-mvp spec never opens a detail tab.
//
// Runs under local-mvp only (see rat-view.mvp.spec.ts for why).

// Deliberately path-less, unlike PNF_WITHOUT_PLAN below and unlike the `local` specs: a supplied
// path is resolved against the ancestors the *first* RAT payload materialises, and that only
// happens for a node the stubs have a `revealNodeId` mapping for. There is none for pnf-e2e-01, so
// a path here would resolve nothing and raise the "Element not found in tree view" dialog. Without
// one the tree also never resolves the node, so the URL is left as given - no rewrite either.
const PNF_WITH_PLAN = {
  id: 'pnf-e2e-01',
  name: 'bbu-gnb-9239238',
  serviceType: 'pnf',
  aaiType: 'pnf',
};

// Path-scoped, because this one *does* have a reveal mapping: without a path the app resolves it
// against the revealed tree and rewrites the URL in place, and because the detail pane is tracked by
// the composed key that rewrite re-creates the pane - dropping the tab this spec just opened. The
// path below is the one the app itself writes. Legacy path-less links are covered deliberately, and
// in one place, by node-view-legacy-deep-link.spec.ts.
const PNF_WITHOUT_PLAN = {
  id: 'si-e2e-02',
  name: 'As_Okruzni-A-84061',
  serviceType: 'pnf',
  aaiType: 'pnf',
  path: [
    'network-management-system:nms-e2e-01',
    'service-instance:si-e2e-02',
    'pnf:si-e2e-02',
  ],
};

const NMS = {
  id: 'nms-e2e-01',
  name: 'mae-east',
  serviceType: 'network-management-system',
  aaiType: 'network-management-system',
};

const CELL_WITH_PLAN = {
  id: '896106361742763',
  name: 'LTE-TM-JHDOM-A-35210-IB11',
  serviceType: 'cell',
  aaiType: 'cell',
};

// detailTab / openConfigTable live in rat-view.helpers.ts: rat-view-network-tab.mvp.spec.ts needs
// the same two, and the ngbNavOutlet fade the helper waits out is the kind of detail a second copy
// would drop.

/** One flattened attribute row of the NRCellDU under this PNF's only GNBDUFunction. */
function cellAttributeRow(table: Locator, attribute: string): Locator {
  return configTableRow(table, 'GNBDUFunction=1/NRCellDU=84000019', attribute);
}

test.describe('Tree View - RAT view Plan tab', { tag: '@mvpOperator' }, () => {
  test('offers a Plan tab beside the live Network tab for a PNF', async ({
    page,
  }) => {
    await page.goto(deepLinkUrl([PNF_WITH_PLAN]));
    await expect(
      page.getByRole('heading', { level: 2, name: 'bbu-gnb-9239238' })
    ).toBeVisible();

    // Both tabs, exactly once each. Asserted by name rather than by qa class so that a regression
    // rendering one label twice, or one tab under the other's label, still fails here.
    await expect(detailTab(page, 'Plan')).toHaveCount(1);
    await expect(detailTab(page, 'Network')).toHaveCount(1);
  });

  test('renders planning attributes from the planning self-link', async ({
    page,
  }) => {
    const configRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/configdata')) {
        configRequests.push(request.url());
      }
    });

    await page.goto(deepLinkUrl([PNF_WITH_PLAN]));
    await expect(
      page.getByRole('heading', { level: 2, name: 'bbu-gnb-9239238' })
    ).toBeVisible();
    const table = await openConfigTable(page, 'Plan');

    // plannedActivationDate and administrativeState=PLANNED exist only in the planning dataspace.
    // Asserting them - rather than "a table rendered" - is what proves the planning branch of
    // ThreegppComponent's selfLink choice ran: both dataspaces return the same MO shape, so a
    // structural assertion passes either way.
    const plannedActivation = table
      .locator('tbody tr:not(.loading-row)')
      .filter({ hasText: 'plannedActivationDate' });
    await expect(plannedActivation).toHaveCount(1);
    await expect(plannedActivation).toContainText('2026-09-01');

    await expect(cellAttributeRow(table, 'administrativeState')).toContainText(
      'PLANNED'
    );

    await expect.poll(() => configRequests.length).toBeGreaterThan(0);
    expect(configRequests.at(-1)).toContain('CoRAN_planning');
  });

  test('keeps planned and live values apart between the two tabs', async ({
    page,
  }) => {
    await page.goto(deepLinkUrl([PNF_WITH_PLAN]));
    // Wait for the detail pane the way the sibling tests do before touching its tabs: going
    // straight from `goto` into a tab click races the pane's own construction.
    await expect(
      page.getByRole('heading', { level: 2, name: 'bbu-gnb-9239238' })
    ).toBeVisible();

    const planTable = await openConfigTable(page, 'Plan');
    await expect(cellAttributeRow(planTable, 'nRTAC')).toContainText('32999');

    // The same node, the same MO, two dataspaces. Sharing one selfLink between the tabs - or
    // caching the first response for both - would make one of these two assertions fail, which no
    // single-tab test can detect.
    const liveTable = await openConfigTable(page, 'Network');
    await expect(cellAttributeRow(liveTable, 'nRTAC')).toContainText('32005');
    await expect(
      cellAttributeRow(liveTable, 'administrativeState')
    ).toContainText('UNLOCKED');
    await expect(
      liveTable
        .locator('tbody tr:not(.loading-row)')
        .filter({ hasText: 'plannedActivationDate' })
    ).toHaveCount(0);

    // Back to Plan: the planned values are still the planned ones. Asserted in both directions
    // because a stale shareReplay would only show up on the second switch.
    const planTableAgain = await openConfigTable(page, 'Plan');
    await expect(cellAttributeRow(planTableAgain, 'nRTAC')).toContainText(
      '32999'
    );
  });

  test('orders the planning tree keys the same way the live Network tree does', async ({
    page,
  }) => {
    await page.goto(deepLinkUrl([PNF_WITH_PLAN]));
    await expect(
      page.getByRole('heading', { level: 2, name: 'bbu-gnb-9239238' })
    ).toBeVisible();
    await detailTab(page, 'Plan').click();

    const treeView = page.locator('app-threegpp-treeview-view');
    await expect(treeView.locator('ng-treeview')).toBeVisible();

    // Filtering reveals the match's descendants and its ancestors only, which keeps the row count
    // inside the virtualised viewport - clicking down four levels of chevrons would not.
    await page
      .locator('.qa_configurations_search input')
      .first()
      .fill('NRCell');

    await expect(treeView.locator('.qa_config_tree_node_label')).toHaveText([
      'ManagedElement',
      'GNBDUFunction',
      'id:1',
      'NRCellDU',
      'id:84000019',
      'attributes',
    ]);

    // The planning stub delivers these as nRTAC, nRPCI, cellLocalId, administrativeState,
    // plannedFrequencyBand.
    await expect(treeView.locator('.qa_config_tree_attribute')).toHaveText([
      'administrativeState:',
      'cellLocalId:',
      'nRPCI:',
      'nRTAC:',
      'plannedFrequencyBand:',
    ]);
  });

  test('names a planning section by its list key when the payload has no id', async ({
    page,
  }) => {
    await page.goto(deepLinkUrl([CELL_WITH_PLAN]));

    const planTab = page.locator('.nav-link.qa_plan_tab_name').first();
    await expect(planTab).toBeVisible();
    await planTab.click();

    const treeView = page.locator('app-threegpp-treeview-view');
    await expect(treeView.locator('ng-treeview')).toBeVisible();
    const rootRow = treeView.getByRole('treeitem').first();
    await expect(rootRow).toContainText('cell-lte-nb-iot');
    const treeItems = treeView.getByRole('treeitem');
    await rootRow.getByRole('button', { name: 'Expand' }).click();
    await expect(
      treeView.getByRole('treeitem', { name: 'attributes', exact: true })
    ).toBeVisible();
    await expect(treeItems.nth(0)).toContainText('cell-lte-nb-iot');
    await expect(treeItems.nth(2)).toContainText('attributes');
    await expect(treeItems.nth(3)).toContainText('cell-relations');
    await expect(treeItems.nth(4)).toContainText('custom-attributes');
  });

  test('explains itself when the node has no planning self-link', async ({
    page,
  }) => {
    await page.goto(deepLinkUrl([PNF_WITHOUT_PLAN]));
    await expect(
      page.getByRole('heading', { level: 2, name: 'As_Okruzni-A-84061' })
    ).toBeVisible();

    await detailTab(page, 'Plan').click();

    // The message has to be the planning-specific one. noDataMessage() branches on the same
    // isPlanningSelfLinkData() input as the fetch does, so a hard-coded string here is the tell
    // that the two drifted - the user would be told the *selflink* is empty when it is not.
    await expect(
      page
        .locator('app-threegpp-treeview app-empty')
        .getByText(
          'Data can not be loaded (planningSelfLink attribute has empty value)'
        )
    ).toBeVisible();

    // The empty state replaces the whole config pane - no search box, no view toggle, no table.
    await expect(
      page.locator('app-threegpp-treeview .qa_configurations_search')
    ).toHaveCount(0);
    await expect(
      page.locator('app-threegpp-treeview .qa_configurations_view_toggle')
    ).toHaveCount(0);
  });

  test('does not request configuration data for a node with no planning link', async ({
    page,
  }) => {
    const configRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/configdata')) {
        configRequests.push(request.url());
      }
    });

    await page.goto(deepLinkUrl([PNF_WITHOUT_PLAN]));
    // As in the sibling tests: wait for the pane before clicking one of its tabs, rather than going
    // straight from `goto` into a click that races the pane's own construction.
    await expect(
      page.getByRole('heading', { level: 2, name: 'As_Okruzni-A-84061' })
    ).toBeVisible();
    await detailTab(page, 'Plan').click();
    await expect(page.locator('app-threegpp-treeview app-empty')).toBeVisible();

    // ngOnInit returns before wiring configData$ when the link is absent. Without that guard CPS is
    // asked for `selfLink=undefined`, and the user gets an error alert instead of an explanation.
    await expectNoRequests(page, configRequests);
  });

  test('shows no Plan tab for a node type that cannot be planned', async ({
    page,
  }) => {
    await page.goto(deepLinkUrl([NMS]));
    await expect(
      page.getByRole('heading', { level: 2, name: 'mae-east' })
    ).toBeVisible();

    // showPlanTab() allows service-instance, pnf and cell only; an NMS has no planning dataspace,
    // so offering the tab would guarantee the empty state. The live Network tab is suppressed for
    // NMS as well, so neither of the two config tabs may appear here.
    await expect(detailTab(page, 'Plan')).toHaveCount(0);
    await expect(detailTab(page, 'Network')).toHaveCount(0);
    await expect(page.locator('.qa_plan_tab_name')).toHaveCount(0);
    await expect(page.locator('.qa_network_tab_name')).toHaveCount(0);
  });

  test('should open Apply Changes confirmation modal', async ({ page }) => {
    await navigateToPlanTabAndEnterEditMode(page, CELL_WITH_PLAN);

    const pciInput = await planAttributeInput(page, 'pci');

    await expect(pciInput).toBeVisible();

    await pciInput.fill('44');
    await expect(pciInput).toHaveValue('44');

    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(
      page.getByText('Are you sure you want to apply changes?')
    ).toBeVisible();

    await expect(page.getByText(/apply changes/i)).toBeVisible();

    await expect(page.locator('.summary')).toContainText('1 fields modified');
  });

  test('should display modified fields in modal', async ({ page }) => {
    await navigateToPlanTabAndEnterEditMode(page, CELL_WITH_PLAN);

    const pciInput = await planAttributeInput(page, 'pci');

    await pciInput.fill('44');

    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await expect(page.locator('.qa_change_path_text')).toHaveCount(1);
    await expect(page.locator('.qa_change_path_text')).toContainText(
      ' 1. cell-lte-nb-iot > attributes > pci '
    );
  });

  test('should expand modified fields list when Show More is clicked', async ({
    page,
  }) => {
    await navigateToPlanTabAndEnterEditMode(page, CELL_WITH_PLAN);

    // Filled in this order because the confirmation dialog lists the changes in the order they
    // were made, not in tree order.
    await (await planAttributeInput(page, 'pci')).fill('125');
    await (await planAttributeInput(page, 'tac')).fill('1421');
    await (await planAttributeInput(page, 'height')).fill('67.1');
    await (await planAttributeInput(page, 'azimuth')).fill('37');
    await (await planAttributeInput(page, 'latitude')).fill('37.8');
    await (await planAttributeInput(page, 'beamwidth')).fill('73');
    await (await planAttributeInput(page, 'earfcn-dl')).fill('375');
    await (await planAttributeInput(page, 'earfcn-ul')).fill('307');
    await (await planAttributeInput(page, 'longitude')).fill('15.79');

    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(
      page.getByText('Are you sure you want to apply changes?')
    ).toBeVisible();

    await expect(page.getByText('Show More')).toBeVisible();
    await page.getByText('Show More').click();

    await expect(page.locator('.changes-list li')).toHaveCount(9);

    await expect(page.locator('.changes-list')).toContainText(
      'cell-lte-nb-iot > attributes > pci'
    );

    await expect(page.locator('.changes-list')).toContainText('126 → 125');
    await expect(page.locator('.qa_change_path_text')).toHaveText([
      '1. cell-lte-nb-iot > attributes > pci',
      '2. cell-lte-nb-iot > attributes > tac',
      '3. cell-lte-nb-iot > attributes > height',
      '4. cell-lte-nb-iot > attributes > azimuth',
      '5. cell-lte-nb-iot > attributes > latitude',
      '6. cell-lte-nb-iot > attributes > beamwidth',
      '7. cell-lte-nb-iot > attributes > earfcn-dl',
      '8. cell-lte-nb-iot > attributes > earfcn-ul',
      '9. cell-lte-nb-iot > attributes > longitude',
    ]);

    await expect(page.getByText('Show Less')).toBeVisible();

    await page.getByText('Show Less').click();

    await expect(page.getByText('Show More')).toBeVisible();

    await expect(page.locator('.changes-list li')).toHaveCount(7);

    await expect(page.getByText('cell-lte-nb-iot > earfcn-ul')).toBeHidden();
  });

  test('should stay in edit mode when user chooses Stay in Edit Mode while switching to table view', async ({
    page,
  }) => {
    await navigateToPlanTabAndEnterEditMode(page, CELL_WITH_PLAN);

    const pciInput = await planAttributeInput(page, 'pci');
    await pciInput.fill('44');

    await page
      .locator('.qa_configurations_view_toggle')
      .getByText('Table')
      .click();

    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Switch to Table View?' })
    ).toBeVisible();
    await expect(
      page.getByText(
        'Table View does not support edit mode. If you switch now, all unsaved changes will be lost.'
      )
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Stay in Edit Mode' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Discard & Switch' })
    ).toBeVisible();
    await page.getByRole('button', { name: /stay in edit mode/i }).click();

    await expect(page.getByText('Apply')).toBeVisible();

    await expect(pciInput).toHaveValue('44');
  });

  test('should discard changes and switch to table view', async ({ page }) => {
    await navigateToPlanTabAndEnterEditMode(page, CELL_WITH_PLAN);

    const pciInput = await planAttributeInput(page, 'pci');
    await pciInput.fill('44');

    await page
      .locator('.qa_configurations_view_toggle')
      .getByText('Table')
      .click();

    await expect(page.locator('[role="dialog"]')).toBeVisible();

    await page.getByRole('button', { name: /discard.*switch/i }).click();

    await expect(page.locator('app-threegpp-table')).toBeVisible();
  });

  test('should continue editing when Continue Editing is clicked', async ({
    page,
  }) => {
    await navigateToPlanTabAndEnterEditMode(page, CELL_WITH_PLAN);

    const tacInput = await planAttributeInput(page, 'tac');

    await tacInput.fill('1421');

    await page.getByText('Cancel').click();
    await expect(page.locator('[role="dialog"]')).toBeVisible();
    await expect(page.getByText('Discard unsaved changes?')).toBeVisible();

    await page
      .getByRole('button', {
        name: 'Continue Editing',
      })
      .click();

    await expect(page.getByText('Cancel')).toBeVisible();
    await expect(page.getByText('Apply')).toBeVisible();
    await expect(tacInput).toHaveValue('1421');
  });

  test('should discard changes and exit edit mode', async ({ page }) => {
    await navigateToPlanTabAndEnterEditMode(page, CELL_WITH_PLAN);

    const tacInput = await planAttributeInput(page, 'tac');

    await tacInput.fill('1421');
    await page.getByText('Cancel').click();

    await page
      .getByRole('button', {
        name: 'Discard Changes',
      })
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeHidden();

    await expect(
      page.getByRole('button', {
        name: /edit attributes/i,
      })
    ).toBeVisible();
  });

  test('should show path specific enum values for target-rat fields', async ({
    page,
  }) => {
    await navigateToPlanTabAndEnterEditMode(page, CELL_WITH_PLAN);

    const selects = page.locator('select');

    await expect(selects.first()).toBeVisible();
  });
});
