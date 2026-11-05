// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { IdentityBadge } from './Identity/IdentityBadge';
import { AuthenticationQueriesView } from './Queries/AuthenticationQueriesView';

export function AuthenticationPage() {
    return <section><h2>Authentication</h2><IdentityBadge /><AuthenticationQueriesView /></section>;
}
