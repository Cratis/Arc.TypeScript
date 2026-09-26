// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { ArcApplication, query, readModel, Severity } from '../../index.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
should();

let calls: string[];
class Dependency { [Symbol.dispose](): void { calls.push('disposed'); } }
@readModel()
class PendingQueries {
    @query({ kind: 'service', token: Dependency, optional: true })
    static snapshot(dependency: Dependency): string { void dependency; calls.push('snapshot'); return 'ready'; }
    @query({ observable: true }, { kind: 'service', token: Dependency, optional: true })
    static observable(dependency: Dependency): CurrentValueSubject<string> {
        void dependency;
        calls.push('observable');
        return CurrentValueSubject.of('ready');
    }
}
function deferred<T>() {
    let release!: (value: T) => void;
    const promise = new Promise<T>(resolve => { release = resolve; });
    return { promise, release };
}
for (const kind of ['snapshot', 'observable'] as const) describe(`when a ${kind} query service settles after cancellation`, () => {
    let application: FetchArcApplication;
    let result: QueryResult | undefined;
    let error: unknown;
    beforeEach(async () => {
        calls = [];
        error = undefined;
        const started = deferred<void>();
        const pending = deferred<Dependency>();
        const controller = new AbortController();
        const builder = ArcApplication.createBuilder();
        builder.services.addScoped(Dependency, () => { started.release(); return pending.promise; });
        builder.add(PendingQueries);
        application = await builder.build();
        const execution = { correlationId: 'query-service-cancel', principal: undefined, tenantId: undefined,
            allowedSeverity: Severity.Warning, signal: controller.signal };
        const running = kind === 'snapshot' ? application.server.performQuery('PendingQueries.snapshot', {}, execution) :
            application.server.openObservableQuery('PendingQueries.observable', {}, execution).then(async session => {
                try { return session.rejection ?? await session.current(); } finally { await session.close(); }
            });
        await started.promise;
        controller.abort(new Error('canceled'));
        pending.release(new Dependency());
        try { result = await running; } catch (failure) { error = failure; }
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail with cancellation', () => {
        if (error) (error as Error).message.should.contain('cancel');
        else {
            result!.isSuccess.should.equal(false);
            result!.exceptionMessages.join(' ').should.contain('canceled');
        }
    });
    it('should not invoke the query or create an observable source', () => {
        calls.should.not.contain('snapshot');
        calls.should.not.contain('observable');
    });
    it('should dispose the resolved service', () => { calls.should.contain('disposed'); });
});
