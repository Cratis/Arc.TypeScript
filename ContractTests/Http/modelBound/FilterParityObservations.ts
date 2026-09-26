// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Fixture-only admission trace, returned through a read-only query. */
export const filterParityEvents: { stage: string; value?: string }[] = [];
export function recordFilterParity(stage: string, value?: string): void {
    filterParityEvents.push({ stage, ...(value === undefined ? {} : { value }) });
}
