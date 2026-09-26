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
    let first: { execution: ExecutionContext; ambient: ExecutionContext | undefined };
    let second: { execution: ExecutionContext; ambient: ExecutionContext | undefined };
    let scopeIdentity: ExecutionContext;
    let firstAmbientSignal: AbortSignal;
    let firstAmbientCorrelation: string;
    let secondAmbientSignal: AbortSignal;
    let constructed: number;
    beforeEach(async () => {
        constructed = 0;
        const service = serviceToken<{ execution: ExecutionContext; ambient: ExecutionContext | undefined }>('cached execution');
        const server = new ArcServer({ services: [
            { token: service, lifetime: ServiceLifetime.Scoped, factory: (_scope, execution) => {
                constructed++;
                return { execution, ambient: currentContext() };
            } }
        ] });
        const scope = server.services.createScope(serviceContext('scope'));
        scopeIdentity = scope.identity!;
        const extra = new AbortController();
        try {
            first = await server.runInScope(scope, async () => {
                firstAmbientSignal = currentContext()!.signal;
                firstAmbientCorrelation = currentContext()!.correlationId;
                return scope.resolve(service);
            }, { signal: extra.signal, correlationId: 'a0f0a604-be5b-4713-b7e5-850570f11275' });
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
        first.execution.should.equal(scopeIdentity);
        first.ambient!.should.equal(scopeIdentity);
        first.ambient!.correlationId.should.equal(scopeIdentity.correlationId);
        first.ambient!.signal.aborted.should.equal(false);
        second.ambient!.signal.aborted.should.equal(false);
        second.ambient!.correlationId.should.equal(scopeIdentity.correlationId);
        scopeIdentity.signal.aborted.should.equal(false);
    });
    it('should link the extra signal only to the first ambient invocation', () => {
        (firstAmbientSignal === scopeIdentity.signal).should.equal(false);
        firstAmbientSignal.aborted.should.equal(true);
        firstAmbientCorrelation.should.equal('a0f0a604-be5b-4713-b7e5-850570f11275');
        secondAmbientSignal.should.equal(scopeIdentity.signal);
        secondAmbientSignal.aborted.should.equal(false);
    });
});
