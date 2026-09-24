// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer, currentServices, serviceToken } from '../../index.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import type { ObservableObserver } from '../../queries/observable/ObservableObserver.js';
import { observableExecution } from '../given/an_observable_execution.js';

should();

describe('when opening an observable query with a scoped dependency', () => {
    let value: string | undefined;
    let disposals: number;

    beforeEach(async () => {
        const token = serviceToken<{ tenant: string; [Symbol.asyncDispose](): Promise<void> }>('subscription');
        disposals = 0;
        const subject = new CurrentValueSubject<string>();
        const server = new ArcServer({ services: [{ token, lifetime: 'scoped', factory: (_, context) => ({
            tenant: context.tenantId ?? '', async [Symbol.asyncDispose]() { disposals++; }
        }) }], observableQueries: [defineObservableQuery({
            name: 'Live', schema: z.object({}), handlerDependencies: [token],
            observe: async () => { const dependency = await currentServices().resolve(token); return {
                subscribe(observer: ObservableObserver<string>) {
                    return subject.subscribe({ ...observer, next: () => observer.next(dependency.tenant) });
                }
            }; }
        })] });
        const session = await server.openObservableQuery('Live', {}, observableExecution({ tenantId: 'second' }));
        const emissions = session.results();
        const next = emissions.next();
        subject.next('notification');
        value = (await next).value?.data;
        await emissions.return(undefined);
        await server.dispose();
    });

    it('should retain the tenant context until the emission', () => { value?.should.equal('second'); });
    it('should dispose the scope after unsubscribe', () => { disposals.should.equal(1); });
});
