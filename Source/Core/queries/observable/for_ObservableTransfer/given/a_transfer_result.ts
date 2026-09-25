// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Severity } from '../../../../validation/Severity.js';
import { queryResult } from '../../../createQueryResult.js';
import type { ExecutionContext } from '../../../../execution/ExecutionContext.js';

const context: ExecutionContext = {
    correlationId: crypto.randomUUID(), signal: new AbortController().signal,
    allowedSeverity: Severity.Warning, principal: undefined, tenantId: undefined
};

export const result = (data: unknown) => queryResult(context, { data });
