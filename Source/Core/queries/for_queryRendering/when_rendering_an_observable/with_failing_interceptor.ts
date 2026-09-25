// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../../dependencyInjection/ServiceLifetime.js';
import { z } from 'zod';
import { should } from 'vitest';
import { given } from '../../../given.js';
import { ArcServer } from '../../../ArcServer.js';
import { serviceToken } from '../../../dependencyInjection/ServiceToken.js';
import { Severity } from '../../../validation/Severity.js';
import { CurrentValueSubject } from '../../observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../observable/defineObservableQuery.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { Task } from '../given/Task.js';
should();

class a_failing_emission {
    readonly token = serviceToken<ReadModelInterceptor>('failing interceptor');
    readonly server = new ArcServer({
        services: [{ token: this.token, lifetime: ServiceLifetime.Scoped, factory: () => ({
            model: Task, intercept: () => { throw new Error('private interception details'); }
        }) }],
        readModelInterceptors: [this.token],
        observableQueries: [defineObservableQuery({ name: 'Watch', schema: z.object({}),
            observe: () => CurrentValueSubject.of([new Task('first')]) })]
    });
}
describe('when rendering an observable with a failing interceptor', given(a_failing_emission, context => {
    let result: { hasExceptions: boolean; exceptionMessages: string[] };
    beforeEach(async () => {
        const session = await context.server.openObservableQuery('Watch', {}, {
            correlationId: crypto.randomUUID(), principal: undefined, tenantId: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Warning
        });
        try { result = (await session.results().next()).value!; }
        finally { await session.close(); }
    });
    afterAll(() => context.server.dispose());
    it('should report a failed emission with redacted details', () => {
        result.hasExceptions.should.equal(true);
        result.exceptionMessages.should.deep.equal(['An unexpected error occurred']);
    });
}));
