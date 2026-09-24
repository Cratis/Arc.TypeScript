// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readModel, query, authorize, AuthenticationStatus } from '../../index.js';
import type { AuthorizationPolicy, AuthorizationPolicyContext } from '../../authorization/AuthorizationPolicy.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

class PolicyDependency { readonly allowed = true; }
class ReadersPolicy implements AuthorizationPolicy {
    static inject = [PolicyDependency];
    constructor(private readonly dependency: PolicyDependency) {}
    authorize(context: AuthorizationPolicyContext): boolean {
        return this.dependency.allowed && context.principal.id === 'alice' &&
            context.target.name === 'Latest' && context.resource.input !== undefined &&
            context.resource.execution.principal?.id === 'alice';
    }
}
@readModel()
class Reports {
    @authorize('Readers')
    @query()
    static Latest(): string { return 'latest'; }
}

describe('when evaluating a scoped class authorization policy', given(an_application_builder, context => {
    let response: Response;
    beforeEach(async () => {
        const builder = context.create({ authentication: [() => ({ status: AuthenticationStatus.Authenticated,
            principal: { id: 'alice', roles: [], isAuthenticated: true } })] });
        builder.services.addScoped(PolicyDependency);
        builder.add(Reports).addAuthorizationPolicy('Readers', ReadersPolicy);
        const app = await builder.build();
        try { response = (await app.server.handle(new Request('http://localhost/api/latest')))!; }
        finally { await app.dispose(); }
    });
    it('should resolve constructor dependencies and receive the target and resource', () => { response.status.should.equal(200); });
}));
