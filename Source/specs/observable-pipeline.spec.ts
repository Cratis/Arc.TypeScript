// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, CurrentValueSubject, ObservableEmissionDecision, Severity, defineObservableQuery, serviceToken } from '../src/index.js';
import type { ExecutionContext, ObservableEmissionGuard, QueryOptions } from '../src/index.js';

should();
const context = (): ExecutionContext => ({
    correlationId: crypto.randomUUID(), signal: new AbortController().signal,
    allowedSeverity: Severity.Warning, principal: undefined, tenantId: 'tenant-one'
});

describe('observable subscription pipeline', () => {
    it('should authorize and validate once while rendering each emission with the requested options', async () => {
        const subject = new CurrentValueSubject([{ id: 'b' }, { id: 'a' }]);
        const options: QueryOptions = { paging: { page: 0, pageSize: 1 }, sorting: { field: 'id', direction: 'asc' } };
        let authorized = 0;
        let validated = 0;
        let observed = 0;
        let captured: QueryOptions | undefined;
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Items', schema: z.object({ term: z.string() }),
            authorize: () => { authorized++; return true; },
            validate: () => { validated++; return []; },
            observe: (_input, _context, requested) => { observed++; captured = requested; return subject; }
        })] });
        const session = await server.openObservableQuery('Items', { term: 'test' }, context(), options);
        const stream = session.results();
        const first = await stream.next();
        first.value?.data.should.deep.equal([{ id: 'a' }]);
        first.value?.paging.should.deep.equal({ page: 0, size: 1, totalItems: 2, totalPages: 2 });
        subject.next([{ id: 'z' }, { id: 'c' }]);
        (await stream.next()).value?.data.should.deep.equal([{ id: 'c' }]);
        authorized.should.equal(1);
        validated.should.equal(1);
        observed.should.equal(1);
        should().equal(captured, options);
        await session.close();
        await server.dispose();
    });

    it('should distinguish the first delivered emission after a suppressed snapshot', async () => {
        const subject = new CurrentValueSubject(1);
        const flags: boolean[] = [];
        let suppressed!: () => void;
        const suppressedOnce = new Promise<void>(resolve => { suppressed = resolve; });
        const token = serviceToken<ObservableEmissionGuard>('first emission');
        const server = new ArcServer({ services: [{ token, lifetime: 'scoped', factory: (): ObservableEmissionGuard => ({
            check(emission) {
                emission.queryName.should.equal('Samples.Value');
                emission.context.tenantId?.should.equal('tenant-one');
                flags.push(emission.isFirstEmission);
                if (emission.data === 1) {
                    suppressed();
                    return ObservableEmissionDecision.Suppress;
                }
                return ObservableEmissionDecision.Allow;
            }
        }) }], observableEmissionGuards: [token], observableQueries: [defineObservableQuery({
            name: 'Value', namespace: 'Samples', schema: z.object({}), observe: () => subject
        })] });
        const session = await server.openObservableQuery('Samples.Value', {}, context());
        const stream = session.results();
        const first = stream.next();
        await suppressedOnce;
        subject.next(2);
        (await first).value?.data.should.equal(2);
        subject.next(3);
        (await stream.next()).value?.data.should.equal(3);
        flags.should.deep.equal([true, true, false]);
        await session.close();
        await server.dispose();
    });

    it('should refuse a second consumer for one subscription scope', async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Value', schema: z.object({}), observe: () => new CurrentValueSubject(1)
        })] });
        const session = await server.openObservableQuery('Value', {}, context());
        const stream = session.results();
        should().throw(() => session.results(), /already consumed/);
        await stream.return(undefined);
        await server.dispose();
    });
});
