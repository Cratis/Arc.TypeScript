// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Convention-based routes for model-bound commands and queries. */
export interface GeneratedApiOptions {
    routePrefix?: string;
    segmentsToSkipForRoute?: number;
    includeCommandNameInRoute?: boolean;
    includeQueryNameInRoute?: boolean;
}
