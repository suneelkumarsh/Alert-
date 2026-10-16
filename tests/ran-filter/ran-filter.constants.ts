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

import type { Page } from '@playwright/test';
import en from '../../../src/assets/i18n/en.json';

export { RAN_FILTER_SOURCES } from '../../../src/app/modules/ran-filter/model/ran-filter.model';

/** Read from the app's translation file, so renaming a label needs no test change. */
export const SOURCE_LABELS = en.ranFilter.sourceLabels;

export type RanFilterSourceKey = keyof typeof SOURCE_LABELS;

/** The conditions hint sentence, read from the translation file. */
export const CONDITIONS_HINT_TEXT =
  en.ranFilter.create.hints.conditionsHintLine1;

/** Checklist labels of the filter requirements panel. */
export const REQUIREMENT_LABELS = en.ranFilter.create.requirements.items;

/** Checklist error hints of the filter requirements panel. */
export const REQUIREMENT_ERRORS = en.ranFilter.create.requirements.errors;

/** Progress sentence with the placeholders resolved, so a broken interpolation fails the test. */
export const requirementMetCount = (met: number, total: number) =>
  en.ranFilter.create.requirements.metCount
    .replace('{{met}}', String(met))
    .replace('{{total}}', String(total));

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const sourceBadge = (page: Page, source: RanFilterSourceKey) =>
  page.locator('.qa_source_badge').filter({
    hasText: new RegExp(`^\\s*${escapeRegExp(SOURCE_LABELS[source])}\\s*$`),
  });
