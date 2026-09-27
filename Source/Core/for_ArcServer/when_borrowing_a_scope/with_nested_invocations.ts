// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer, currentContext } from '../../ArcServer.js';
import { requestContext } from '../../execution/RequestContextStore.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { Severity } from '../../validation/Severity.js';
import { captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when borrowing a scope with nested and rejected invocations', () => {
    let correlations: (string | undefined)[];
    let restoredServices: boolean;
    let failure: unknown;
    let linkedSignal: AbortSignal;
    beforeEach(async () => {
        correlations = [];
        const server = new ArcServer({});
        const controller = new AbortController();
        const extra = new AbortController();
        const original = { correlationId: 'outside', tenantId: 'outside', principal: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Error };
        const scope = server.services.createScope({ ...original, correlationId: 'scope', tenantId: 'scope', signal: controller.signal });
        try {
            await requestContext.run(original, async () => {
                correlations.push(currentContext()?.correlationId);
                await server.runInScope(scope, async () => {
                    correlations.push(currentContext()?.correlationId);
                    linkedSignal = currentContext()!.signal;
                    await server.runInScope(scope, async () => {
                        await Promise.resolve();
                        correlations.push(currentContext()?.correlationId);
                    }, { correlationId: 'a0f0a604-be5b-4713-b7e5-850570f11275' });
                    correlations.push(currentContext()?.correlationId);
                    failure = await captureFailure(server.runInScope(scope, async () => {
                        correlations.push(currentContext()?.correlationId);
                        throw new Error('callback rejected');
                    }, { correlationId: 'b0f0a604-be5b-4713-b7e5-850570f11275' }));
                    correlations.push(currentContext()?.correlationId);
                    restoredServices = currentServices() === scope;
                }, { correlationId: 'c0f0a604-be5b-4713-b7e5-850570f11275', signal: extra.signal });
                correlations.push(currentContext()?.correlationId);
            });
            correlations.push(currentContext()?.correlationId);
            extra.abort();
        } finally { await scope.dispose(); await server.dispose(); }
    });
    it('should restore context on return and rejection', () => {
        correlations.should.deep.equal(['outside', 'c0f0a604-be5b-4713-b7e5-850570f11275',
            'a0f0a604-be5b-4713-b7e5-850570f11275', 'c0f0a604-be5b-4713-b7e5-850570f11275',
            'b0f0a604-be5b-4713-b7e5-850570f11275', 'c0f0a604-be5b-4713-b7e5-850570f11275', 'outside', undefined]);
        restoredServices.should.equal(true);
        (failure as Error).message.should.equal('callback rejected');
    });
    it('should link the extra signal without replacing the scope signal', () => linkedSignal.aborted.should.be.true);
});
