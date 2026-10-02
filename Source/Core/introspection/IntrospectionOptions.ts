// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Access to catalogs, OpenAPI, identity schema, and user/tenant discovery. */
export interface IntrospectionOptions {
    /** Map command/query catalogs and HTTP OpenAPI by default. False leaves identity discovery and in-process metadata unchanged. */
    enabled?: boolean;
    /** Anonymous only in Development by default; false explicitly allows anonymous discovery everywhere. */
    requireAuthentication?: boolean;
    /** Comma-separated roles, any one of which grants access. Implies authentication; cannot be combined with false. */
    roles?: string;
}
