// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
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

for (const kind of ['snapshot', 'observable'] as const) for (const stage of ['validator factory', 'async validator', 'performer factory'] as const)
    describe(`when a ${kind} query is canceled during ${stage} after filters`, () => {
        let application: FetchArcApplication;
        let result: QueryResult | undefined;
        let calls: string[];
        beforeEach(async () => {
            calls = [];
            const started = deferred<void>();
            const pending = deferred<void>();
            const controller = new AbortController();
            class Validator { [Symbol.dispose](): void { calls.push('validator disposed'); } }
            class Performer { [Symbol.dispose](): void { calls.push('performer disposed'); } }
            const common = { name: 'Later', schema: z.object({}), authorization: { anonymous: true },
                validatorDependencies: [Validator], handlerDependencies: [Performer],
                validate: async () => {
                    calls.push('validator');
                    if (stage === 'async validator') { started.release(); await pending.promise; }
                    return [];
                } };
            const builder = ArcApplication.createBuilder(kind === 'observable' ? { observableQueries: [defineObservableQuery({
                ...common, observe: () => { calls.push('producer'); return CurrentValueSubject.of('ready'); }
            })] } : { queries: [defineQuery({ ...common, perform: () => { calls.push('producer'); return 'ready'; } })] });
            builder.services.addScoped(Validator, async () => {
                calls.push('validator factory');
                if (stage === 'validator factory') { started.release(); await pending.promise; }
                return new Validator();
            }).addScoped(Performer, async () => {
                calls.push('performer factory');
                if (stage === 'performer factory') { started.release(); await pending.promise; }
                return new Performer();
            });
            application = await builder.build();
            const execution = { correlationId: 'query-cancel-after-filter', principal: undefined, tenantId: undefined,
                allowedSeverity: Severity.Warning, signal: controller.signal };
            const running = kind === 'snapshot' ? application.server.performQuery('Later', {}, execution) :
                application.server.openObservableQuery('Later', {}, execution).then(async session => {
                    try { return session.rejection ?? await session.current(); } finally { await session.close(); }
                });
            await started.promise;
            controller.abort(new Error('canceled'));
            pending.release();
            result = await running;
        });
        afterEach(async () => { await application.dispose(); });
        it('should return an unsuccessful cancellation', () => {
            result!.isSuccess.should.equal(false);
            result!.hasExceptions.should.equal(true);
        });
        it('should not start downstream validation or a producer', () => {
            if (stage === 'validator factory') calls.should.not.contain('validator');
            if (stage === 'async validator') calls.should.not.contain('performer factory');
            calls.should.not.contain('producer');
        });
        it('should dispose any resolved dependencies', () => {
            if (stage === 'validator factory') calls.should.contain('validator disposed');
            if (stage === 'performer factory') calls.should.contain('performer disposed');
        });
    });
