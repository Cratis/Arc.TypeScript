// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, inject, scoped } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

class Dependency { readonly name = 'injected'; }

@scoped()
class ScopedDependency {
    static inject = [Dependency] as const;
    constructor(readonly dependency: Dependency) {}
}

@command()
class ScopedCommand {
    @inject(ScopedDependency)
    handle(service: ScopedDependency): string { return service.dependency.name; }
}

describe('when resolving a scoped service with static inject', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create();
        builder.services.addTransient(Dependency);
        builder.add(ScopedDependency, ScopedCommand);
        const application = await builder.build();
        try {
            result = (await application.server.handle(new Request('http://localhost/api/scoped-command', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            })))!;
        } finally { await application.dispose(); }
    });
    it('should inject the declared constructor service', async () => {
        (await result.json()).response.should.equal('injected');
    });
}));
