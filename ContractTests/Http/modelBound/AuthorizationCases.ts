// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { field } from '@cratis/fundamentals';
import { allowAnonymous, authorize, path, query, readModel, roles } from '@cratis/arc.core';

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

/** Roles in one declaration are OR; an explicit method declaration replaces the class declaration. */
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

/** A method role that replaces anonymous access on the class. */
@readModel({ namespace: 'HttpFixture' })
@allowAnonymous()
export class AnonymousClassCases {
    @field(String) value!: string;

    @roles('Reader')
    @path('/api/role-cases/anonymous-class')
    @query()
    static AnonymousReader(): AnonymousClassCases { return Object.assign(new AnonymousClassCases(), { value: 'reader' }); }
}

/** A method role that replaces a different class role. */
@readModel({ namespace: 'HttpFixture' })
@roles('Admin')
export class MethodRoleCases {
    @field(String) value!: string;

    @roles('Reader')
    @path('/api/role-cases/replacement')
    @query()
    static ReplacementReader(): MethodRoleCases { return Object.assign(new MethodRoleCases(), { value: 'reader' }); }
}
