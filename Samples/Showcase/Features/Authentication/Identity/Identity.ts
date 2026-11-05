// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { identityDetailsProvider, type ExecutionContext, type IdentityDetailsProvider, type Principal } from '@cratis/arc.core';

/** The details `/.cratis/me` returns to the signed in user. */
export class IdentityDetails {
    @field(String) displayName!: string;
    @field(String) tenant!: string;
    @field(Boolean) isAdmin!: boolean;
}

@identityDetailsProvider()
export class ShowcaseIdentity implements IdentityDetailsProvider {
    readonly detailsType = IdentityDetails;

    provide(principal: Principal, context: ExecutionContext): IdentityDetails {
        return {
            displayName: principal.name ?? principal.id,
            tenant: context.tenantId ?? 'default',
            isAdmin: principal.roles.includes('Admin')
        };
    }
}
