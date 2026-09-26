// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import type { QueryContext } from '../../queries/QueryContext.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { Severity } from '../../validation/Severity.js';
should();

function deferred<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>(resolve => { release = resolve; });
    return { promise, release };
}

for (const kind of ['snapshot', 'observable'] as const) for (const stage of ['pre-aborted', 'pre-aborted empty groups', 'resolving authorization',
    'pending authorization', 'resolving pipeline', 'pending pipeline'] as const) {
    describe(`when a ${kind} query is canceled with ${stage}`, () => {
        let application: FetchArcApplication;
        let result: QueryResult | undefined;
        let error: unknown;
        let calls: string[];
        let disposed: number;
        beforeEach(async () => {
            calls = [];
            disposed = 0;
            error = undefined;
            const controller = new AbortController();
            const started = deferred<void>();
            const factory = deferred<{ onPerform(context: QueryContext): void }>();
            const filter = deferred<void>();
            class First {
                onPerform(): Promise<void> | void {
                    calls.push('first');
                    if (stage === 'pending authorization' || stage === 'pending pipeline') {
                        started.release();
                        return filter.promise;
                    }
                }
                [Symbol.dispose](): void { disposed++; }
            }
            class Later { onPerform(): void { calls.push('later'); } }
            class ValidatorDependency {}
            const definition = { name: 'Cancelable', schema: z.object({}), authorization: { anonymous: true },
                validatorDependencies: [ValidatorDependency],
                validate: () => { calls.push('validate'); return []; } };
            const builder = ArcApplication.createBuilder(kind === 'observable' ? { observableQueries: [defineObservableQuery({
                ...definition, observe: () => { calls.push('observe'); return CurrentValueSubject.of('ready'); }
            })] } : { queries: [defineQuery({ ...definition, perform: () => { calls.push('perform'); return 'ready'; } })] });
            builder.services.addScoped(ValidatorDependency, () => {
                calls.push('validator factory');
                return new ValidatorDependency();
            }).addScoped(First, () => {
                calls.push('factory');
                if (stage === 'resolving authorization' || stage === 'resolving pipeline') {
                    started.release();
                    return factory.promise;
                }
                return new First();
            }).addScoped(Later);
            if (stage === 'resolving pipeline' || stage === 'pending pipeline')
                builder.addQueryPipelineFilter(First).addQueryPipelineFilter(Later);
            else if (stage !== 'pre-aborted empty groups') builder.addAuthorizationQueryFilter(First).addAuthorizationQueryFilter(Later);
            application = await builder.build();
            if (stage === 'pre-aborted' || stage === 'pre-aborted empty groups') controller.abort(new Error('canceled'));
            const running = kind === 'observable' ? application.server.openObservableQuery('Cancelable', {}, {
                correlationId: 'cancel-observable', principal: undefined, tenantId: undefined,
                allowedSeverity: Severity.Warning, signal: controller.signal
            }).then(async session => { try { return session.rejection ?? await session.current(); } finally { await session.close(); } }) :
                application.server.performQuery('Cancelable', {}, { correlationId: 'cancel-query',
                    principal: undefined, tenantId: undefined, allowedSeverity: Severity.Warning, signal: controller.signal });
            if (stage !== 'pre-aborted' && stage !== 'pre-aborted empty groups') {
                await started.promise;
                controller.abort(new Error('canceled'));
                factory.release(new First());
                filter.release();
            }
            try { result = await running; } catch (failure) { error = failure; }
        });
        afterEach(async () => { await application.dispose(); });
        it('should fail without treating cancellation as authorization denial', () => {
            if (error) (error as Error).message.should.contain('cancel');
            else {
                result!.isSuccess.should.equal(false);
                result!.isAuthorized.should.equal(true);
                result!.hasExceptions.should.equal(true);
            }
        });
        it('should not start later filters or validation or a producer', () => {
            if (stage === 'pre-aborted' || stage === 'pre-aborted empty groups' || stage === 'resolving authorization' || stage === 'resolving pipeline')
                calls.should.not.contain('first');
            calls.should.not.contain('later');
            calls.should.not.contain('validate');
            calls.should.not.contain('validator factory');
            calls.should.not.contain('perform');
            calls.should.not.contain('observe');
        });
        it('should dispose constructed scoped filters', () => {
            disposed.should.equal(stage === 'pre-aborted' || stage === 'pre-aborted empty groups' ? 0 : 1);
        });
    });
}
