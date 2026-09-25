// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { allowAnonymous, authorize, command, path, query, readModel, roles } from '@cratis/arc.core';

/** A class-protected read model with an anonymous method override. */
@readModel({ namespace: 'HttpFixture' })
@authorize()
export class AuthorizationOverride {
    @field(String) value!: string;

    @allowAnonymous()
    @path('/api/auth-override/public')
    @query()
    static Public(): AuthorizationOverride { return Object.assign(new AuthorizationOverride(), { value: 'public' }); }

    @path('/api/auth-override/private')
    @query()
    static Private(): AuthorizationOverride { return Object.assign(new AuthorizationOverride(), { value: 'private' }); }
}

/** A class-protected command whose handler accepts anonymous callers. */
@command({ namespace: 'HttpFixture' })
@authorize()
export class PublicOverrideCommand {
    @allowAnonymous()
    handle(): { value: string } { return { value: 'public' }; }
}

/** Roles in one declaration are OR; the class and method requirements are AND. */
@readModel({ namespace: 'HttpFixture' })
@roles('Admin', 'Reader')
export class RoleCases {
    @field(String) value!: string;

    @path('/api/role-cases/either')
    @query()
    static Either(): RoleCases { return Object.assign(new RoleCases(), { value: 'either' }); }

    @roles('Admin')
    @path('/api/role-cases/both')
    @query()
    static Both(): RoleCases { return Object.assign(new RoleCases(), { value: 'both' }); }
}
