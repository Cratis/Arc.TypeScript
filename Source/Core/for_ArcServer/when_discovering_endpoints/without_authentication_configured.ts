// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '../../ArcServer.js';
import { a_discovery_host } from '../given/a_discovery_host.js';

describe('when discovering endpoints without authentication configured outside Development', () => {
    let responses: (Response | null)[];
    let context: a_discovery_host;
    let mapped: boolean[];
    beforeEach(async () => {
        context = new a_discovery_host();
        const server = new ArcServer({ ...context.options, authentication: [], development: true });
        try {
            mapped = context.paths.map(path => server.endpoints.has(path));
            responses = await Promise.all(context.paths.flatMap(path => [server.handle(new Request(`http://localhost${path}`)),
                server.handle(new Request(`http://localhost${path}`))]));
        } finally { await server.dispose(); }
    });
    it('should leave all descriptions unmapped regardless of the provider development flag', () => mapped.should.deep.equal(Array(6).fill(false)));
    it('should not claim requests for those paths', () => responses.should.deep.equal(Array(12).fill(null)));
    it('should log a single warning despite multiple routes and requests', () => context.warnings.calledOnce.should.be.true);
    it('should name the opt-out setting in the warning', () => String(context.warnings.firstCall.args[0]).should.contain('Cratis:Arc:Introspection:RequireAuthentication=false'));
});
