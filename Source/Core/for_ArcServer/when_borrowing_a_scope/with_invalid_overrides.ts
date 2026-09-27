// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceDependencyError } from '../../dependencyInjection/ServiceDependencyError.js';
import { captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when borrowing a scope with an invalid override or an aborted signal', () => {
    let failures: unknown[];
    let callbacks: number;
    beforeEach(async () => {
        const server = new ArcServer({});
        const scopeController = new AbortController();
        const extra = new AbortController();
        const scope = server.services.createScope({ ...serviceContext('tenant'), signal: scopeController.signal });
        callbacks = 0;
        const callback = () => { callbacks++; };
        try {
            failures = await Promise.all(['', 'not-a-uuid', '00000000-0000-0000-0000-000000000000', 42]
                .map(correlationId => captureFailure(server.runInScope(scope, callback, { correlationId: correlationId as string }))));
            extra.abort();
            failures.push(await captureFailure(server.runInScope(scope, callback, { signal: extra.signal })));
            scopeController.abort();
            failures.push(await captureFailure(server.runInScope(scope, callback)));
        } finally { await scope.dispose(); await server.dispose(); }
    });
    it('should reject invalid correlations with a clear error', () => {
        failures.slice(0, 4).forEach(failure => {
            (failure instanceof ServiceDependencyError).should.equal(true);
            (failure as Error).message.should.equal('Invalid correlation ID override');
        });
    });
    it('should reject both already-aborted sources without calling the callback', () => {
        failures.slice(4).forEach(failure => (failure as Error).message.should.equal('Borrowed scope signal is already aborted'));
        callbacks.should.equal(0);
    });
});
