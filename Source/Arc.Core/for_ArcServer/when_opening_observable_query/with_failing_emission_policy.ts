// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer, serviceToken } from '../../index.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import type { ObservableEmissionGuard } from '../../queries/observable/ObservableEmissionGuard.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();

describe('when opening an observable query with a failing emission policy', () => {
    let authorized: boolean | undefined;
    let data: unknown;
    let done: boolean | undefined;
    let logged: unknown[];

    beforeEach(async () => {
        const subject = CurrentValueSubject.of(1);
        const token = serviceToken<ObservableEmissionGuard>('failing policy');
        logged = [];
        const server = new ArcServer({ logger: error => { logged.push(error); },
            services: [{ token, lifetime: 'scoped', factory: (): ObservableEmissionGuard => ({
                check: () => { throw new Error('secret'); }
            }) }], observableEmissionGuards: [token], observableQueries: [defineObservableQuery({
                name: 'Numbers', schema: z.object({}), observe: () => subject
            })] });
        const session = await server.openObservableQuery('Numbers', {}, observableExecution());
        const stream = session.results();
        const denial = await stream.next();
        authorized = denial.value?.isAuthorized;
        data = denial.value?.data;
        subject.next(2);
        done = (await stream.next()).done;
        await server.dispose();
    });

    it('should deny the terminal result', () => { authorized?.should.equal(false); });
    it('should not publish data', () => { should().equal(data, undefined); });
    it('should terminate after denial', () => { done?.should.equal(true); });
    it('should log the policy failure once', () => { logged.should.have.lengthOf(1); });
    it('should log an error', () => { (logged[0] instanceof Error).should.equal(true); });
});
