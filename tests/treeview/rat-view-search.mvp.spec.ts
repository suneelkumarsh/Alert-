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
  expectNoSearchRequest,
  expectNothingAutoSelected,
  searchTree,
  toggleButton,
  treeRow,
  treeSearchInput,
} from './rat-view.helpers';

// TNAP-30342 AC2: the tree filter matches on id *and* name across all object types. Search is a
// materially different code path from the lazy tree - it drops `depth`, suppresses the deep-link
// reveal, and relies on TreeExpansionService to open the branches containing matches - so none of
// the lazy-loading coverage says anything about it.
//
// Runs under local-mvp only (see rat-view.mvp.spec.ts for why).

test.describe('Tree View - RAT view search', { tag: '@mvpOperator' }, () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/treeview');
    await expect(page.locator('app-rat-view')).toBeVisible();
    await expect(
      treeRow(page, 'network-management-system:nms-e2e-01')
    ).toBeVisible();
  });

  test('reveals a deep match with its ancestors already expanded', async ({
    page,
  }) => {
    await searchTree(page, 'Okruzni');

    // The whole pruned branch renders without a single click. The match is three levels down, so
    // its two ancestors being visible is what proves TreeExpansionService ran - the search
    // response carries materialised children but the library still starts every node collapsed.
    const NMS1 = 'network-management-system:nms-e2e-01';
    const SI2 = 'service-instance:si-e2e-02';
    const PNF_SI2 = 'pnf:si-e2e-02';
    await expect(treeRow(page, NMS1)).toBeVisible();
    await expect(treeRow(page, NMS1, SI2)).toBeVisible();
    await expect(treeRow(page, NMS1, SI2, PNF_SI2)).toBeVisible();
    await expect(toggleButton(page, NMS1)).toHaveAttribute(
      'aria-label',
      'Collapse'
    );
    await expect(toggleButton(page, NMS1, SI2)).toHaveAttribute(
      'aria-label',
      'Collapse'
    );

    // Non-matching roots are pruned by the backend and must not survive the merge.
    await expect(
      treeRow(page, 'network-management-system:nms-e2e-02')
    ).toHaveCount(0);
    await expect(
      treeRow(page, 'network-management-system:nms-e2e-03')
    ).toHaveCount(0);
  });

  test('highlights the matched substring in the matched label', async ({
    page,
  }) => {
    await searchTree(page, 'Okruzni');

    const match = treeRow(
      page,
      'network-management-system:nms-e2e-01',
      'service-instance:si-e2e-02',
      'pnf:si-e2e-02'
    );
    await expect(match).toBeVisible();
    // HighlightPipe wraps the hit in <span class="highlight">. Asserting the element, not just the
    // text, is the difference between "the row is there" and "the user can see why".
    await expect(match.locator('span.highlight')).toHaveText('Okruzni');
  });

  test('searches on the full tree, not the lazy depth=1 tree', async ({
    page,
  }) => {
    const treeRequests: string[] = [];
    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/ran-treeview?')) {
        treeRequests.push(url);
      }
    });

    await searchTree(page, 'Okruzni');
    await expect(
      treeRow(
        page,
        'network-management-system:nms-e2e-01',
        'service-instance:si-e2e-02',
        'pnf:si-e2e-02'
      )
    ).toBeVisible();

    // Per the API contract a non-blank search returns the full pruned subtree regardless of depth,
    // so the UI must stop sending depth=1 - otherwise the backend only ever searches the roots.
    const searchRequest = treeRequests.at(-1)!;
    expect(searchRequest).toContain('search=Okruzni');
    expect(searchRequest).not.toContain('depth=');
  });

  test('ignores a query shorter than three characters', async ({ page }) => {
    const treeRequests: string[] = [];
    page.on('request', request => {
      if (request.url().includes('/api/ran-treeview?')) {
        treeRequests.push(request.url());
      }
    });

    await treeSearchInput(page).fill('Ok');

    // Below the threshold nothing is dispatched at all, and the unfiltered tree stays put.
    await expectNoSearchRequest(page, treeRequests);
    await expect(
      treeRow(page, 'network-management-system:nms-e2e-02')
    ).toBeVisible();
  });

  test('restores the full tree when the search is cleared', async ({
    page,
  }) => {
    await searchTree(page, 'Okruzni');
    await expect(
      treeRow(page, 'network-management-system:nms-e2e-02')
    ).toHaveCount(0);

    // The × button only exists while the field has content, so its presence is part of the
    // contract being asserted here.
    await page.locator('app-rat-view .qa_reset_search_input').click();

    await expect(
      treeRow(page, 'network-management-system:nms-e2e-01')
    ).toBeVisible();
    await expect(
      treeRow(page, 'network-management-system:nms-e2e-02')
    ).toBeVisible();
    await expect(
      treeRow(page, 'network-management-system:nms-e2e-03')
    ).toBeVisible();
    await expect(treeSearchInput(page)).toHaveValue('');
    await expect(page.locator('span.highlight')).toHaveCount(0);
  });

  test('keeps the query in the URL so a filtered tree can be shared', async ({
    page,
  }) => {
    await searchTree(page, 'Okruzni');
    await expect(page).toHaveURL(/[?&]query=Okruzni/);

    // A reload has to reproduce the same filtered tree from the URL alone: ngOnInit seeds the
    // search from the `query` param, which is the half of the round-trip a URL assertion after
    // typing cannot prove.
    await page.reload();
    await expect(page.locator('app-rat-view')).toBeVisible();
    await expect(treeSearchInput(page)).toHaveValue('Okruzni');
    await expect(
      treeRow(
        page,
        'network-management-system:nms-e2e-01',
        'service-instance:si-e2e-02',
        'pnf:si-e2e-02'
      )
    ).toBeVisible();
    await expect(
      treeRow(page, 'network-management-system:nms-e2e-02')
    ).toHaveCount(0);
  });

  test('shows the empty state when nothing matches', async ({ page }) => {
    // No stub keys on this query, so WireMock 404s and the component's catchError maps it to an
    // empty tree - the same rendering path as a genuine no-match response.
    await treeSearchInput(page).fill('no-such-node-anywhere');

    await expect(page.locator('app-empty')).toBeVisible();
    await expect(
      treeRow(page, 'network-management-system:nms-e2e-01')
    ).toHaveCount(0);
  });

  // TNAP-30342 AC2: the search term is matched against each node's id as well as its label.
  // The query below is the numeric cell id; the cell's label ('cell-north') contains none of it,
  // so any match that renders is an id match — name matching alone would return an empty tree.
  test('filters the tree by cell id when the id differs from the name', async ({
    page,
  }) => {
    await searchTree(page, '84099901');

    const NMS1 = 'network-management-system:nms-e2e-01';
    const SI1 = 'service-instance:si-e2e-01';
    const PNF1 = 'pnf:pnf-e2e-01';
    const cellRow = treeRow(page, NMS1, SI1, PNF1, 'cell:84099901');
    await expect(cellRow).toBeVisible();

    // The row otherwise shows its label alone, so an id match arrives looking unrelated to what was
    // typed. The id is rendered beside the label - not instead of it - and highlighted like a label
    // match would be.
    await expect(cellRow.locator('.qa_matched_id')).toHaveText('(84099901)');
    await expect(cellRow.locator('.qa_matched_id span.highlight')).toHaveText(
      '84099901'
    );
    await expect(cellRow.locator('.qa_instance_node')).toHaveText('cell-north');
    // A row matched on its label keeps showing the label alone.
    await expect(treeRow(page, NMS1).locator('.qa_matched_id')).toHaveCount(0);

    // Sibling NMS roots carrying no node whose id or name matches are pruned by the backend.
    await expect(
      treeRow(page, 'network-management-system:nms-e2e-02')
    ).toHaveCount(0);
  });

  // TNAP-30342 AC2.1, entered the way the AC describes it: an external CGI link carrying select and
  // the query together. Nothing is typed, which is now the only way in - a query the *user* types
  // spends the parameter instead (see the test after this one).
  test('select=true auto-selects the unique match and opens the detail pane', async ({
    page,
  }) => {
    // 'autoslt' appears in cell id 'autoslt-01' only; no other node label or id in the stub
    // contains it, so findSingleMatch returns exactly that cell. The outer beforeEach navigated to
    // plain /treeview first; this goto replaces that navigation entirely.
    await page.goto('/treeview?select=true&query=autoslt');
    await expect(page.locator('app-rat-view')).toBeVisible();

    // The seeded query, proving the load under test is the URL's and not a leftover of the
    // beforeEach navigation.
    await expect(treeSearchInput(page)).toHaveValue('autoslt');

    const cellRow = treeRow(
      page,
      'network-management-system:nms-e2e-01',
      'service-instance:si-e2e-01',
      'pnf:pnf-e2e-01',
      'cell:autoslt-01'
    );
    await expect(cellRow).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('app-treeview-detail')).toBeVisible();
    // A visible-but-empty pane is not enough: assert the cell's data loaded.
    await expect(page.locator('app-treeview-detail')).toContainText(
      'autoslt-01'
    );
    // The matched leaf is selected, not the whole revealed path.
    await expect(
      page.locator('[role="treeitem"][aria-selected="true"]')
    ).toHaveCount(1);

    // Nothing moved focus and no row can take it in this view, so the live region is the only
    // announcement a screen-reader user gets.
    await expect(page.locator('.qa_auto_selected_status')).toContainText(
      'cell-autoselect'
    );

    // The parameter is spent: a reload, a bookmark or a copied URL must not select all over again,
    // while the query it selected on stays shareable.
    await expect(page).not.toHaveURL(/[?&]select=/);
    await expect(page).toHaveURL(/[?&]query=autoslt/);
  });

  // The other half of AC2.1's scope: it describes the filter a link arrives with, not a mode the
  // session stays in. Auto-selecting a query typed later would move focus mid-typing.
  test('select=true does not auto-select a query the user types themselves', async ({
    page,
  }) => {
    await page.goto('/treeview?select=true');
    await expect(page.locator('app-rat-view')).toBeVisible();

    await searchTree(page, 'autoslt');

    const cellRow = treeRow(
      page,
      'network-management-system:nms-e2e-01',
      'service-instance:si-e2e-01',
      'pnf:pnf-e2e-01',
      'cell:autoslt-01'
    );
    // The unique match is found and revealed - it is simply not selected for the user.
    await expect(cellRow).toBeVisible();
    await expectNothingAutoSelected(page);
    await expect(page).not.toHaveURL(/[?&]select=/);
  });

  // TNAP-30342 AC2.1 (no-op branch): select=true + a query matching two nodes → both rows
  // remain explorable and no auto-selection fires.
  test('select=true leaves both rows visible and selects nothing when two cells match', async ({
    page,
  }) => {
    // 'multisl' appears in both 'multisl-c1' and 'multisl-c2'; findSingleMatch returns null.
    await page.goto('/treeview?select=true&query=multisl');
    await expect(page.locator('app-rat-view')).toBeVisible();

    const NMS1 = 'network-management-system:nms-e2e-01';
    const SI1 = 'service-instance:si-e2e-01';
    const PNF1 = 'pnf:pnf-e2e-01';
    await expect(
      treeRow(page, NMS1, SI1, PNF1, 'cell:multisl-c1')
    ).toBeVisible();
    await expect(
      treeRow(page, NMS1, SI1, PNF1, 'cell:multisl-c2')
    ).toBeVisible();
    // The count is the primary assertion: far stronger than 'no detail pane rendered', which could
    // also be true if the pane failed to render for an unrelated reason.
    await expectNothingAutoSelected(page);
  });

  // TNAP-30342 AC2.1 against the payload the backend actually produces.
  //
  // `TreeviewMapper.mapRanChildren` puts the PNFs *and* those PNFs' generic-VNFs at level 3 under
  // the service-instance, and `@Mapping(target="children", source="cells")` sits on both
  // `toRanDto(Pnf)` and `toRanDto(GenericVnf)` - the same Cell set, mapped twice. `pruneNode` keeps
  // every ancestor whose subtree retains a match, so a cell search returns the cell under the BBU
  // *and* under the gNodeB. `getRanTreeviewSearchAutoSelect.json` gives its cell a single parent, so
  // it cannot see this.
  //
  // Two rows, one entity: `findSingleMatch` dedupes by `ranNodeKey`, so the match is unambiguous and
  // AC2.1 selects it. Counting rows instead answers "ambiguous" and silently selects nothing - which
  // is what this stub caught.
  test('select=true auto-selects a cell reachable through both its BBU and its gNodeB', async ({
    page,
  }) => {
    // 'twinsel' is the cell id; no label in the stub contains it ('cell-twin-north' is broken by
    // the hyphen), so both hits are id matches on the same cell.
    await page.goto('/treeview?select=true&query=twinsel');
    await expect(page.locator('app-rat-view')).toBeVisible();

    const NMS1 = 'network-management-system:nms-e2e-01';
    const SI1 = 'service-instance:si-e2e-01';
    const CELL = 'cell:twinsel-01';
    const underBbu = treeRow(page, NMS1, SI1, 'pnf:pnf-e2e-01', CELL);
    const underGnb = treeRow(page, NMS1, SI1, 'generic-vnf:gvnf-e2e-gnb', CELL);

    // Both occurrences render - asserted first so a failure below cannot be read as "the
    // duplicated branch never arrived".
    await expect(underBbu).toBeVisible();
    await expect(underGnb).toBeVisible();

    // Exactly one row selected, because there is exactly one cell.
    await expect(
      page.locator('[role="treeitem"][aria-selected="true"]')
    ).toHaveCount(1);
    // First occurrence wins, matching the BBU-first convention `revealActivatedPath` and
    // `findPathSegmentsTo` already follow.
    await expect(underBbu).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('app-treeview-detail')).toContainText(
      'twinsel-01'
    );

    // The library's own answer to the same duplication: the unselected occurrence is flagged as the
    // twin of the selected one, keyed on the shared trailing `cell:twinsel-01` segment.
    await expect(underGnb).toHaveClass(/twin-of-selected/);
  });
});
