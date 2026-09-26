// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';

should();
describe('when borrowing a cached scoped service after an extra signal aborts', () => {
    let first: { execution: ExecutionContext };
    let second: { execution: ExecutionContext };
    let scopeSignal: AbortSignal;
    let firstAmbientSignal: AbortSignal;
    let secondAmbientSignal: AbortSignal;
    let constructed: number;
    beforeEach(async () => {
        constructed = 0;
        const service = serviceToken<{ execution: ExecutionContext }>('cached execution');
        const server = new ArcServer({ services: [
            { token: service, lifetime: ServiceLifetime.Scoped, factory: (_scope, execution) => {
                constructed++;
                return { execution };
            } }
        ] });
        const scope = server.services.createScope(serviceContext('scope'));
        scopeSignal = scope.identity!.signal;
        const extra = new AbortController();
        try {
            first = await server.runInScope(scope, async () => {
                firstAmbientSignal = currentContext()!.signal;
                return scope.resolve(service);
            }, { signal: extra.signal });
            extra.abort();
            second = await server.runInScope(scope, async () => {
                secondAmbientSignal = currentContext()!.signal;
                return scope.resolve(service);
            });
        } finally { await scope.dispose(); await server.dispose(); }
    });
    it('should reuse the scoped instance across invocations', () => {
        (second === first).should.equal(true);
        constructed.should.equal(1);
    });
    it('should keep the factory signal live after the extra signal aborts', () => {
        first.execution.signal.should.equal(scopeSignal);
        second.execution.signal.aborted.should.equal(false);
        scopeSignal.aborted.should.equal(false);
    });
    it('should link the extra signal only to the first ambient invocation', () => {
        (firstAmbientSignal === scopeSignal).should.equal(false);
        firstAmbientSignal.aborted.should.equal(true);
        secondAmbientSignal.should.equal(scopeSignal);
        secondAmbientSignal.aborted.should.equal(false);
    });
});
