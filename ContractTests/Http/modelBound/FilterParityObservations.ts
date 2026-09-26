// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { currentContext } from '@cratis/arc.core';

/** Fixture-only admission trace, returned through a read-only query. */
export const filterParityEvents: { stage: string; value?: string; correlationId?: string }[] = [];
export function recordFilterParity(stage: string, value?: string): void {
    const correlationId = currentContext()?.correlationId;
    filterParityEvents.push({ stage, ...(value === undefined ? {} : { value }),
        ...(correlationId === undefined ? {} : { correlationId }) });
}
