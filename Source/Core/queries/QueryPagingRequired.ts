// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Signals a provider limit that requires the caller to request a smaller page. */
export class QueryPagingRequired extends Error {
    constructor(readonly maxPageSize: number, unpaged = false) {
        super(unpaged ? `The result exceeds the maximum page size of ${maxPageSize}; request paging` :
            `Page size exceeds the maximum page size of ${maxPageSize}`);
    }
}
