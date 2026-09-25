// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer, serviceToken } from '../../index.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import type { ObservableEmissionGuard } from '../../queries/observable/ObservableEmissionGuard.js';
import { ObservableEmissionDecision } from '../../queries/observable/ObservableEmissionDecision.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();

describe('when opening an observable query with a suppressed first emission', () => {
    let delivered: number | undefined;
    let tenants: (string | undefined)[];
    let names: string[];
    let flags: boolean[];

    beforeEach(async () => {
        const subject = CurrentValueSubject.of(1);
        const token = serviceToken<ObservableEmissionGuard>('emission policy');
        tenants = [];
        names = [];
        flags = [];
        let suppressed!: () => void;
        const suppressedOnce = new Promise<void>(resolve => { suppressed = resolve; });
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped, factory: (): ObservableEmissionGuard => ({
            check: emission => {
                tenants.push(emission.context.tenantId);
                names.push(emission.queryName);
                flags.push(emission.isFirstEmission);
                if (emission.data === 1) { suppressed(); return ObservableEmissionDecision.Suppress; }
                return ObservableEmissionDecision.Allow;
            }
        }) }], query: { observableEmissionGuards: [token] }, observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => subject
        })] });
        const session = await server.openObservableQuery('Numbers', {}, observableExecution());
        const stream = session.results();
        const first = stream.next();
        await suppressedOnce;
        subject.next(2);
        delivered = (await first).value?.data;
        await stream.return(undefined);
        await server.dispose();
    });

    it('should preserve the tenant context', () => { tenants.should.deep.equal(['first', 'first']); });
    it('should preserve the query name', () => { names.should.deep.equal(['Numbers', 'Numbers']); });
    it('should flag the delivered emission as first', () => { flags.should.deep.equal([true, true]); });
    it('should deliver the next permitted value', () => { delivered?.should.equal(2); });
});
