// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Source used to resolve a request's tenant. */
export enum TenantResolverType {
    /** Resolve from an HTTP header. */
    Header = 'header',
    /** Resolve from a query parameter. */
    Query = 'query',
    /** Resolve from a principal claim. */
    Claim = 'claim',
    /** Use a configured tenant ID. */
    Fixed = 'fixed',
    /** Use the development tenant. */
    Development = 'development',
    /** Resolve from a subdomain. */
    Subdomain = 'subdomain'
}
