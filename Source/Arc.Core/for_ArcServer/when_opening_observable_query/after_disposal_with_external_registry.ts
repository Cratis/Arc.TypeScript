// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer, ServiceRegistry, Severity } from '../../index.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when opening an observable query after disposal with an external registry', () => {
    let error: unknown;

    beforeEach(async () => {
        const registry = new ServiceRegistry();
        const server = new ArcServer({ services: registry, observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => new CurrentValueSubject<number>(1)
        })] });
        const context: ExecutionContext = { correlationId: crypto.randomUUID(), signal: new AbortController().signal,
            allowedSeverity: Severity.Warning, principal: undefined, tenantId: undefined };
        await server.dispose();
        try { await server.openObservableQuery('Value', {}, context); } catch (reason) { error = reason; }
        await registry.dispose();
    });

    it('should reject the new subscription', () => {
        (error instanceof Error).should.equal(true);
        (error as Error).message.should.contain('Arc server is disposed');
    });
});
