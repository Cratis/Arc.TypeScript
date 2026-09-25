// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Signals a provider paging limit; queryOperation maps this error to a Size validation rule. */
export class QueryPagingRequired extends Error {
    /**
     * @param maxPageSize The largest page the provider will return.
     * @param unpaged Whether an unpaged result exceeded the limit rather than a requested page size.
     * @param message Optional provider-specific guidance for callers that cannot page through this operation.
     */
    constructor(readonly maxPageSize: number, unpaged = false, message?: string) {
        super(message ?? (unpaged ? `The result exceeds the maximum page size of ${maxPageSize}; request paging` :
            `Page size exceeds the maximum page size of ${maxPageSize}`));
    }
}
