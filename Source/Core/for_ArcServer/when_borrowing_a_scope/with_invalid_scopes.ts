// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ServiceScope } from '../../dependencyInjection/ServiceScope.js';
import { ServiceDependencyError } from '../../dependencyInjection/ServiceDependencyError.js';
import { Severity } from '../../validation/Severity.js';
import { captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when borrowing scopes without the server registry authority', () => {
    let failures: unknown[];
    beforeEach(async () => {
        const server = new ArcServer({});
        const foreign = new ArcServer({});
        const identity = { correlationId: 'original', principal: undefined, tenantId: 'tenant',
            signal: new AbortController().signal, allowedSeverity: Severity.Warning };
        const closed = server.services.createScope(identity);
        await closed.dispose();
        const forged = Object.create(ServiceScope.prototype) as ServiceScope;
        const shadowed = foreign.services.createScope(identity);
        Object.defineProperties(shadowed, { registry: { value: server.services }, singleton: { value: false }, disposed: { value: false } });
        try {
            failures = await Promise.all([shadowed, closed, server.services.singletonScope(), forged]
                .map(scope => captureFailure(Promise.resolve().then(() => server.runInScope(scope, () => 'unexpected')))));
        } finally { await foreign.dispose(); await server.dispose(); }
    });
    it('should reject foreign closed singleton and fabricated scopes', () => {
        failures.should.have.length(4);
        failures.forEach(failure => (failure instanceof ServiceDependencyError).should.be.true);
    });
});
