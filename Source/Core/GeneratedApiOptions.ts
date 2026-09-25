// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Convention-based routes for model-bound commands and queries. */
export interface GeneratedApiOptions {
    /** Base path segment for generated endpoints; defaults to api. */
    routePrefix?: string;
    /** Namespace segments skipped when building generated routes; defaults to zero. */
    segmentsToSkipForRoute?: number;
    /** Include the command name in its generated route; enabled by default. */
    includeCommandNameInRoute?: boolean;
    /** Include the query name in its generated route; enabled by default. */
    includeQueryNameInRoute?: boolean;
    /** Accept HTTP QUERY as well as GET for generated queries; enabled by default. */
    enableQueryHttpMethod?: boolean;
    /** Version shown in the OpenAPI info object; defaults to 0.1.0. */
    openApiVersion?: string;
}
