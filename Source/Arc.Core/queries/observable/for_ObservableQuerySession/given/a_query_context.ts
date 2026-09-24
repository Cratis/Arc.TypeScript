// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../../../../execution/ExecutionContext.js';
import { Severity } from '../../../../validation/Severity.js';

export const queryContext = (): ExecutionContext => ({
    correlationId: crypto.randomUUID(), signal: new AbortController().signal,
    allowedSeverity: Severity.Warning, principal: undefined, tenantId: 'tenant-one'
});
