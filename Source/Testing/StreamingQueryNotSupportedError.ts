// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** A declared streaming query cannot run in a snapshot query scenario. */
export class StreamingQueryNotSupportedError extends Error {
    constructor(readonly queryName: string) {
        super(`Streaming query ${queryName} is not supported by QueryScenario; use ObservableQueryScenario`);
        this.name = 'StreamingQueryNotSupportedError';
    }
}
