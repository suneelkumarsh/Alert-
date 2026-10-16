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

const OPERATIONS = {
  planning: 'planning-data-import',
  runtime: 'runtime-data-import',
  backup: 'backup-data-import',
} as const;

const PLANNING = {
  workflowType: 'ImportPlanningDataWorkflow',
  workflowId: 'import-planning-data',
  runId: '01a0aeaf-ee90-7383-9392-0c41ee1ce5fb',
  status: 'RUNNING',
} as const;

const RUNTIME = {
  workflowType: 'ImportRuntimeConfigWorkflow',
  workflowId: 'import-runtime-config-ericsson',
  runId: '01a0aeaf-18f0-7293-af3f-8c65c4133b4b',
  status: 'RUNNING',
} as const;

const BACKUP = {
  workflowType: 'ImportBackupDataWorkflow',
  workflowId: 'import-backup-data-huawei',
  runId: '01a0aea8-9a32-7d58-8f34-330933c190c2',
  status: 'COMPLETED',
} as const;

const RAN_DATA_IMPORTER_PERMISSIONS = [
  {
    rsid: '1',
    rsname: 'ran_import_manager_resource',
    scopes: ['GET', 'POST'],
  },
] as const;

async function grantRanDataImporterAccess(
  page: Parameters<typeof test>[0]['page']
): Promise<void> {
  await page.route(
    '**/realms/**/protocol/openid-connect/token',
    async route => {
      const postData = route.request().postData() ?? '';

      if (
        postData.includes('response_mode=permissions') &&
        postData.includes('audience=portal-bff')
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(RAN_DATA_IMPORTER_PERMISSIONS),
        });
        return;
      }

      await route.continue();
    }
  );
}

async function openImporter(
  page: Parameters<typeof test>[0]['page'],
  operation: string
): Promise<void> {
  await grantRanDataImporterAccess(page);
  await page.goto(`/administration/ran-data-importer?operation=${operation}`);
  await expect(page.locator('.qa_ran_data_importer_page')).toBeVisible();
}

async function expectFirstRow(
  page: Parameters<typeof test>[0]['page'],
  expected: { workflowType: string; workflowId: string; status: string }
): Promise<void> {
  const firstRow = page.locator('.qa_live_tasks_table tbody tr').first();
  await expect(firstRow).toBeVisible();

  await expect(firstRow.locator('.qa_workflowType_value')).toHaveText(
    expected.workflowType
  );
  await expect(firstRow.locator('.qa_workflowId_value')).toHaveText(
    expected.workflowId
  );
  await expect(firstRow.locator('.qa_status_value')).toContainText(
    expected.status
  );
}

test.describe('Ran Data Importer', () => {
  test('renders the planning, runtime, and backup workflow lists from the HAR', async ({
    page,
  }) => {
    await openImporter(page, OPERATIONS.planning);
    await expect(page.locator('.qa_live_tasks_table tbody tr')).toHaveCount(10);
    await expectFirstRow(page, PLANNING);

    await page.goto(
      `/administration/ran-data-importer?operation=${OPERATIONS.runtime}`
    );
    await expect(page.locator('.qa_live_tasks_table tbody tr')).toHaveCount(4);
    await expectFirstRow(page, RUNTIME);

    await page.goto(
      `/administration/ran-data-importer?operation=${OPERATIONS.backup}`
    );
    await expect(page.locator('.qa_live_tasks_table tbody tr')).toHaveCount(5);
    await expectFirstRow(page, BACKUP);
  });

  test('opens the planning workflow manual-verification detail panel and resumes it', async ({
    page,
  }) => {
    await grantRanDataImporterAccess(page);
    await page.goto(
      `/administration/ran-data-importer?operation=${OPERATIONS.planning}&runId=${PLANNING.runId}`
    );

    await expect(page.locator('.qa_ran_data_importer_detail')).toBeVisible();
    await expect(page.locator('.qa_workflow_detail_summary')).toBeVisible();
    await expect(page.locator('.qa_workflow_detail_steps_title')).toBeVisible();
    await expect(page.locator('.qa_workflow_detail_step')).toHaveCount(4);
    await expect(page.locator('.qa_files_generated_success')).toBeVisible();

    // The list is sorted with localeCompare, so assert membership instead of order.
    const downloadedFiles = page.locator(
      '.qa_step2_downloaded_files .fw-semibold.text-truncate'
    );
    await expect(downloadedFiles).toHaveCount(3);
    for (const fileName of [
      'cell-lte-nb-iot-relations.csv',
      'cell-lte.csv',
      'transmission-vlans.csv',
    ]) {
      await expect(downloadedFiles.filter({ hasText: fileName })).toHaveCount(
        1
      );
    }

    await expect(page.locator('.qa_resume_import')).toBeEnabled();

    const resumeRequest = page.waitForResponse(
      response =>
        response.request().method() === 'POST' &&
        response
          .url()
          .includes(
            '/api/ran-import-manager/import/planning-data/workflows/import-planning-data/runs/01a0aeaf-ee90-7383-9392-0c41ee1ce5fb'
          ) &&
        response.status() === 200
    );

    await page.locator('.qa_resume_import').click();
    await resumeRequest;

    await expect(page.locator('.qa_ran_data_importer_detail')).toHaveCount(0);
  });
});
