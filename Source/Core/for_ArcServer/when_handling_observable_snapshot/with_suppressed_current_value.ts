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

should();

describe('when handling an observable snapshot with a suppressed current value', () => {
    let status: number | undefined;
    let data: unknown;

    beforeEach(async () => {
        const token = serviceToken<ObservableEmissionGuard>('suppress snapshots');
        const server = new ArcServer({ services: [{ token, lifetime: ServiceLifetime.Scoped, factory: (): ObservableEmissionGuard => ({
            check: () => ObservableEmissionDecision.Suppress
        }) }], query: { observableEmissionGuards: [token] }, observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), observe: () => CurrentValueSubject.of(7)
        })] });
        const response = await server.handle(new Request('http://localhost/api/numbers'));
        status = response?.status;
        data = (await response!.json()).data;
        await server.dispose();
    });

    it('should report pending', () => { status?.should.equal(202); });
    it('should not expose the suppressed value', () => { should().equal(data, undefined); });
});
