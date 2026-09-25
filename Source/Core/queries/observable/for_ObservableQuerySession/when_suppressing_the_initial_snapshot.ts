// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { serviceToken } from '../../../index.js';
import type { ObservableEmissionGuard } from '../ObservableEmissionGuard.js';
import { ObservableEmissionDecision } from '../ObservableEmissionDecision.js';
import { CurrentValueSubject } from '../CurrentValueSubject.js';
import { defineObservableQuery } from '../defineObservableQuery.js';
import { queryContext } from './given/a_query_context.js';

should();

describe('when suppressing the initial snapshot', () => {
    let first: unknown;
    let second: unknown;
    let flags: boolean[];
    let names: string[];
    let tenants: (string | undefined)[];

    beforeEach(async () => {
        const subject = new CurrentValueSubject(1);
        flags = [];
        names = [];
        tenants = [];
        let suppressed!: () => void;
        const suppressedOnce = new Promise<void>(resolve => { suppressed = resolve; });
        const token = serviceToken<ObservableEmissionGuard>('first emission');
        const server = new ArcServer({ services: [{ token, lifetime: 'scoped', factory: (): ObservableEmissionGuard => ({
            check(emission) {
                names.push(emission.queryName);
                tenants.push(emission.context.tenantId);
                flags.push(emission.isFirstEmission);
                if (emission.data === 1) {
                    suppressed();
                    return ObservableEmissionDecision.Suppress;
                }
                return ObservableEmissionDecision.Allow;
            }
        }) }], query: { observableEmissionGuards: [token] }, observableQueries: [defineObservableQuery({
            name: 'Value', namespace: 'Samples', schema: z.object({}), observe: () => subject
        })] });
        const session = await server.openObservableQuery('Samples.Value', {}, queryContext());
        const stream = session.results();
        const pending = stream.next();
        await suppressedOnce;
        subject.next(2);
        first = (await pending).value?.data;
        subject.next(3);
        second = (await stream.next()).value?.data;
        await session.close();
        await server.dispose();
    });

    it('should preserve the qualified query name', () => { names.should.deep.equal(['Samples.Value', 'Samples.Value', 'Samples.Value']); });
    it('should preserve the execution tenant', () => { tenants.should.deep.equal(['tenant-one', 'tenant-one', 'tenant-one']); });
    it('should deliver the first allowed emission', () => { should().equal(first, 2); });
    it('should deliver the next emission', () => { should().equal(second, 3); });
    it('should flag the first delivered emission as first', () => { flags.should.deep.equal([true, true, false]); });
});
