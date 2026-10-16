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
import {
  configTableRow,
  deepLinkUrl,
  detailTab,
  expectNoRequests,
  openConfigTable,
} from './rat-view.helpers';

// TNAP-32279: the Network (Configuration) tab was hidden for a *RAN Node* service instance even
// though AAI gives it a populated selflink, so its live configuration was unreachable in the UI.
// The tab's @if excluded four `metadata.type` values (GNB / BBU / RAN NODE / NMS) and
// `metadata.type` comes from AAI's serviceType - it says nothing about whether a self-link exists.
//
// Why the pre-existing suite could not catch it: every Network-tab test covered a PNF, a Cell or a
// generic-vnf (treeview-configuration-view.spec.ts), and the only two RAT-session tab tests asserted
// the tab count for a PNF and an NMS (rat-view-plan-tab.mvp.spec.ts). No spec ever opened a RAN Node
// service-instance detail pane, and no service-instance fixture carried a selflink - so the whole
// node type was invisible to the suite.
//
// A count assertion alone would not have been enough either: the tab has to render *this* node's
// CPS document, which is what the NRCellCU row below pins down.
//
// Runs under local-mvp only (see rat-view.mvp.spec.ts for why).

/** RAN Node service instance with a populated selflink - the node type from the bug report. */
const RAN_NODE_WITH_SELFLINK = {
  id: 'si-e2e-01',
  name: 'gnb-9239238',
  serviceType: 'RAN Node',
  aaiType: 'service-instance',
};

/** Same node type, no selflink in its fixture - the documented empty state, not a hidden tab. */
const RAN_NODE_WITHOUT_SELFLINK = {
  id: 'si-e2e-02',
  name: 'gnb-9239239',
  serviceType: 'RAN Node',
  aaiType: 'service-instance',
};

const NMS = {
  id: 'nms-e2e-01',
  name: 'mae-east',
  serviceType: 'network-management-system',
  aaiType: 'network-management-system',
};

test.describe(
  'Tree View - RAT view Network tab for a RAN Node',
  { tag: '@mvpOperator' },
  () => {
    test('offers the Network tab for a RAN Node service instance', async ({
      page,
    }) => {
      await page.goto(deepLinkUrl([RAN_NODE_WITH_SELFLINK]));
      await expect(
        page.getByRole('heading', { level: 2, name: 'gnb-9239238' })
      ).toBeVisible();

      // Exactly once, and beside the Plan tab. The two were inconsistent before the fix - Plan is
      // gated on `aaiType === service-instance` and rendered, Network was gated on
      // `type !== 'RAN NODE'` and did not - so asserting both is what pins the contradiction shut.
      await expect(detailTab(page, 'Network')).toHaveCount(1);
      await expect(detailTab(page, 'Plan')).toHaveCount(1);
    });

    test('renders the RAN Node own CPS configuration in the Network tab', async ({
      page,
    }) => {
      const configRequests: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/configdata')) {
          configRequests.push(request.url());
        }
      });

      await page.goto(deepLinkUrl([RAN_NODE_WITH_SELFLINK]));
      await expect(
        page.getByRole('heading', { level: 2, name: 'gnb-9239238' })
      ).toBeVisible();

      const table = await openConfigTable(page, 'Network');

      // GNBCUCPFunction/NRCellCU with nRTAC 32101 exists only in this service instance's document -
      // the PNF below it carries GNBDUFunction/NRCellDU with 32005. So this fails both if the tab
      // renders nothing and if it resolved the wrong node's self-link.
      await expect(
        configTableRow(table, 'GNBCUCPFunction=1/NRCellCU=84000019', 'nRTAC')
      ).toContainText('32101');

      // decoded, because selfLink travels as one percent-encoded query param
      await expect.poll(() => configRequests.length).toBeGreaterThan(0);
      expect(decodeURIComponent(configRequests.at(-1)!)).toContain(
        'anchors/gnb-9239238'
      );
    });

    test('explains itself for a RAN Node with no self-link instead of hiding the tab', async ({
      page,
    }) => {
      const configRequests: string[] = [];
      page.on('request', request => {
        if (request.url().includes('/api/configdata')) {
          configRequests.push(request.url());
        }
      });

      await page.goto(deepLinkUrl([RAN_NODE_WITHOUT_SELFLINK]));
      await expect(
        page.getByRole('heading', { level: 2, name: 'gnb-9239239' })
      ).toBeVisible();

      // The point of the fix: an absent self-link is ThreegppComponent's business, not a reason to
      // drop the tab. The live-data message, not the planning one - noDataMessage() branches on the
      // same isPlanningSelfLinkData() input the fetch does, so the wrong string means the two drifted.
      await expect(detailTab(page, 'Network')).toHaveCount(1);
      await detailTab(page, 'Network').click();
      await expect(
        page
          .locator('app-threegpp-treeview app-empty')
          .getByText(
            'Configuration can’t be loaded (selflink attribute has empty value)'
          )
      ).toBeVisible();

      // ngOnInit returns before wiring configData$, so CPS is never asked for `selfLink=undefined`,
      // which would surface as an error alert rather than this explanation.
      await expectNoRequests(page, configRequests);
    });

    test('still hides the Network tab for an NMS', async ({ page }) => {
      await page.goto(deepLinkUrl([NMS]));
      await expect(
        page.getByRole('heading', { level: 2, name: 'mae-east' })
      ).toBeVisible();

      // The other half of the fix: only RAN NODE left the exclusion list. An NMS has no CPS
      // document at all, so widening the condition to "always show" would guarantee a permanent
      // empty state here.
      await expect(detailTab(page, 'Network')).toHaveCount(0);
    });

    test('renders the detail tabs in the documented order for a RAN Node', async ({
      page,
    }) => {
      await page.goto(deepLinkUrl([RAN_NODE_WITH_SELFLINK]));
      const detail = page.locator('app-treeview-detail');
      await expect(
        page.getByRole('heading', { level: 2, name: 'gnb-9239238' })
      ).toBeVisible();

      // TNAP-30772 AC6 is about DOM order, which is not the ngbNavItem numbering (the ids run
      // 3, 4, 0, 1, 8, 2, 5, 6, 7 down the template). Network has to land last here, after Plan;
      // a fix applied by moving the <li> instead of relaxing its condition would show up here.
      // Missing from the list: AAI and Alarms, whose resources (`treeview_aai_ui_resource`,
      // `alarm_resource`) are not in tnap-realm.yaml, and Software / CM Actions, which are PNF-only.
      // See rat-view-rbac.mvp.spec.ts for the PNF sequence.
      await expect(detail.getByRole('tab')).toHaveText([
        'Service Instance',
        'Slices',
        'Cells',
        'Plan',
        'Network',
      ]);
    });
  }
);
