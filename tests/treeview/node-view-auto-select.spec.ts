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

import { Page, Locator } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { expectNothingAutoSelected, treeRow } from './rat-view.helpers';

// TNAP-30342 AC2.1 for the NODE view. Runs under the `local` project (test-admin has no
// mvp_operator, so treeview.component.html renders <app-node-view>) - the RAT half is
// rat-view-search.mvp.spec.ts.
//
// Not a duplicate of that file: this view reaches the same feature through different code. Its
// results are paginated, so "exactly one match" is a claim about a result set it may only partly
// hold - hence the completeness guard, which has no counterpart in the RAT view. Its search state
// also round-trips through the `filter` param rather than `query`, and its rows are focusable
// buttons, which is why auto-selection here can move focus at all.

/** The node view's search box; `tnap-input-search` renders one input, tagged with a qa class. */
function searchInput(page: Page): Locator {
  return page.locator('app-node-view .qa_search_field');
}

const SI_SEG = 'service-instance:73000005';
const PNF_SEG = 'pnf:b64f1a7e-beef-4533-b467-1c9da22e75f2';

/**
 * A substring of the PNF's id and of nothing else in the stub - notably not of its name
 * ('73000005'), so the whole match is an id match.
 */
const UNIQUE_FILTER = 'beef-4533';

test.describe('Tree View - node view auto-selection', () => {
  test('select=true opens the only matching node without a click', async ({
    page,
  }) => {
    await page.goto(`/treeview?filter=${UNIQUE_FILTER}&select=true`);
    await expect(page.locator('app-node-view')).toBeVisible();

    // The seeded filter, proving the load under test is the URL's own.
    await expect(searchInput(page)).toHaveValue(UNIQUE_FILTER);

    const pnfRow = treeRow(page, SI_SEG, PNF_SEG);
    await expect(pnfRow).toBeVisible();
    // The value carries the meaning - aria-selected is rendered on every row, so a presence check
    // would pass on an unselected one too.
    await expect(pnfRow).toHaveAttribute('aria-selected', 'true');
    // The matched node, not the whole revealed path.
    await expect(
      page.locator('[role="treeitem"][aria-selected="true"]')
    ).toHaveCount(1);

    // A visible-but-empty pane is not enough: 'Ericsson' comes from the PNF's own response, so it
    // only renders if the detail request for the auto-selected node went out and resolved.
    await expect(page.locator('app-treeview-detail')).toContainText('Ericsson');

    // Announced, because nothing else says a pane opened - the tree never took focus.
    await expect(page.locator('.qa_auto_selected_status')).toContainText(
      '73000005'
    );
  });

  test('spends the parameter, keeping the selection it produced shareable', async ({
    page,
  }) => {
    await page.goto(`/treeview?filter=${UNIQUE_FILTER}&select=true`);
    await expect(page.locator('app-node-view')).toBeVisible();
    await expect(treeRow(page, SI_SEG, PNF_SEG)).toHaveAttribute(
      'aria-selected',
      'true'
    );

    // Polled: dropping the parameter is a second navigation, deferred so it cannot supersede the
    // selection's own - which is exactly what the two assertions below check together.
    await expect
      .poll(() => new URL(page.url()).searchParams.has('select'))
      .toBe(false);
    await expect
      .poll(() => new URL(page.url()).searchParams.get('selectedNodes') ?? '')
      .toContain('b64f1a7e-beef-4533-b467-1c9da22e75f2');
    expect(new URL(page.url()).searchParams.get('filter')).toBe(UNIQUE_FILTER);

    // The URL that remains reproduces the selection on its own, with nothing left to re-arm.
    await page.reload();
    await expect(page.locator('app-node-view')).toBeVisible();
    await expect(treeRow(page, SI_SEG, PNF_SEG)).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('waits for the whole result set before calling a match unique', async ({
    page,
  }) => {
    // 'beef' matches the same single PNF on page 1, but the response reports a larger total: the
    // other matches are on pages this view has not loaded, so nothing here is unambiguous yet.
    await page.goto('/treeview?filter=beef&select=true');
    await expect(page.locator('app-node-view')).toBeVisible();

    const pnfRow = treeRow(page, SI_SEG, PNF_SEG);
    await expect(pnfRow).toBeVisible();
    await expectNothingAutoSelected(page);
  });

  test('does not auto-select a filter the user types themselves', async ({
    page,
  }) => {
    await page.goto('/treeview?select=true');
    await expect(page.locator('app-node-view')).toBeVisible();

    await searchInput(page).fill(UNIQUE_FILTER);

    const pnfRow = treeRow(page, SI_SEG, PNF_SEG);
    // The unique match is found and revealed - it is simply not selected for the user. Selecting it
    // would move focus to that row's button and swallow the keystrokes that follow.
    await expect(pnfRow).toBeVisible();
    await expectNothingAutoSelected(page);
    await expect
      .poll(() => new URL(page.url()).searchParams.has('select'))
      .toBe(false);
  });

  test('shows the matched id next to a label that does not contain the filter', async ({
    page,
  }) => {
    await page.goto(`/treeview?filter=${UNIQUE_FILTER}`);
    await expect(page.locator('app-node-view')).toBeVisible();

    const pnfRow = treeRow(page, SI_SEG, PNF_SEG);
    await expect(pnfRow).toBeVisible();
    // The row otherwise shows its label alone ('73000005'), which contains nothing of what was
    // typed - so the id supplies the missing reason, highlighted like a label match would be.
    await expect(pnfRow.locator('.qa_matched_id')).toHaveText(
      '(b64f1a7e-beef-4533-b467-1c9da22e75f2)'
    );
    await expect(pnfRow.locator('.qa_matched_id .highlight')).toHaveText(
      UNIQUE_FILTER
    );
    // The label is kept, not replaced: it is still how the user recognises the node.
    await expect(pnfRow.locator('.qa_instance_node')).toContainText('73000005');
    // A row that is only an ancestor of the match shows no id.
    await expect(treeRow(page, SI_SEG).locator('.qa_matched_id')).toHaveCount(
      0
    );
  });
});
