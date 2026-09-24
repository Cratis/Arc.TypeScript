// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, ServiceRegistry, Severity, currentServices, defineQuery, serviceToken } from '../../index.js';
import { shouldRejectWithError } from '../shouldRejectWithError.js';
import { originalFailure } from '../../results/failureTracking.js';

should();
const context = (tenantId: string) => ({ correlationId: crypto.randomUUID(), principal: undefined, tenantId, signal: new AbortController().signal, allowedSeverity: Severity.Warning });
function gate(): { promise: Promise<void>; release: () => void } {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}
async function beforeDeadline<T>(work: Promise<T>, name: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([work, new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error(`${name} hung`)), 1000);
        })]);
    } finally { if (timer) clearTimeout(timer); }
}

describe('service lifecycle transitions', () => {
    it('does not carry a settled scoped factory owner into detached manual scopes', async () => {
        const origin = serviceToken<object>('origin');
        const tenant = serviceToken<{ tenant: string | undefined }>('tenant');
        const started = gate(); const released = gate();
        let detached!: Promise<string | undefined>;
        const registry = new ServiceRegistry([
            { token: origin, lifetime: 'scoped', factory: () => {
                detached = (async () => {
                    started.release();
                    await released.promise;
                    const beta = registry.createScope(context('beta'));
                    try { return (await beta.resolve(tenant)).tenant; } finally { await beta.dispose(); }
                })();
                return {};
            } },
            { token: tenant, lifetime: 'scoped', factory: (_scope, identity) => ({ tenant: identity.tenantId }) }
        ]);
        const alpha = registry.createScope(context('alpha'));
        try {
            await alpha.resolve(origin);
            await started.promise;
            await alpha.dispose();
            released.release();
            should().equal(await beforeDeadline(detached, 'detached scoped owner'), 'beta');
        } finally { released.release(); await registry.dispose(); }
    });
    it('does not carry a settled singleton owner or captivity into detached scoped and transient resolutions', async () => {
        const origin = serviceToken<object>('singleton origin');
        const tenant = serviceToken<{ tenant: string | undefined }>('scoped tenant');
        const transient = serviceToken<{ tenant: string | undefined }>('transient tenant');
        const started = gate(); const released = gate();
        let detached!: Promise<readonly (string | undefined)[]>;
        const registry = new ServiceRegistry([
            { token: origin, lifetime: 'singleton', factory: () => {
                detached = (async () => {
                    started.release(); await released.promise;
                    const beta = registry.createScope(context('beta'));
                    try { return [(await beta.resolve(tenant)).tenant, (await beta.resolve(transient)).tenant]; }
                    finally { await beta.dispose(); }
                })();
                return {};
            } },
            { token: tenant, lifetime: 'scoped', factory: (_scope, identity) => ({ tenant: identity.tenantId }) },
            { token: transient, lifetime: 'transient', factory: (_scope, identity) => ({ tenant: identity.tenantId }) }
        ]);
        const alpha = registry.createScope(context('alpha'));
        try {
            await alpha.resolve(origin);
            await started.promise;
            await alpha.dispose();
            released.release();
            (await beforeDeadline(detached, 'detached singleton owner')).should.deep.equal(['beta', 'beta']);
        } finally { released.release(); await registry.dispose(); }
    });
    it('keeps a live singleton factory captive even through a newly created manual scope', async () => {
        const origin = serviceToken<object>('live singleton');
        const scoped = serviceToken<object>('scoped child');
        const registry = new ServiceRegistry([
            { token: origin, lifetime: 'singleton', factory: async () => {
                const manual = registry.createScope(context('beta'));
                try { await manual.resolve(scoped); } finally { await manual.dispose(); }
                return {};
            } },
            { token: scoped, lifetime: 'scoped', factory: () => ({}) }
        ]);
        try {
            const alpha = registry.createScope(context('alpha'));
            await shouldRejectWithError(beforeDeadline(alpha.resolve(origin), 'live singleton manual scope'), /Captive/);
        } finally { await registry.dispose(); }
    });
    it('cleans partial manual-scope resources before rejecting despite a historical ambient chain', async () => {
        const origin = serviceToken<object>('origin');
        const partial = serviceToken<object>('partial');
        const broken = serviceToken<object>('broken');
        const released = gate(); const calls: string[] = [];
        let detached!: Promise<unknown>;
        const registry = new ServiceRegistry([
            { token: origin, lifetime: 'scoped', factory: () => {
                detached = (async () => {
                    await released.promise;
                    const manual = registry.createScope(context('beta'));
                    return manual.resolve(broken);
                })();
                return {};
            } },
            { token: partial, lifetime: 'scoped', factory: () => ({ [Symbol.dispose]: () => { calls.push('disposed'); } }) },
            { token: broken, lifetime: 'scoped', dependencies: [partial], factory: async scope => {
                await scope.resolve(partial);
                throw new Error('broken');
            } }
        ]);
        const alpha = registry.createScope(context('alpha'));
        try {
            await alpha.resolve(origin);
            await alpha.dispose();
            released.release();
            await shouldRejectWithError(beforeDeadline(detached, 'detached manual cleanup'), /factory failed/);
            (calls).should.deep.equal(['disposed']);
        } finally { released.release(); await registry.dispose(); }
    });
    it('uses fresh attempts for detached transient re-resolution after successful settlement', async () => {
        const token = serviceToken<object>('detached transient');
        const released = gate();
        let detached!: Promise<object>;
        let constructions = 0; let disposals = 0;
        const registry = new ServiceRegistry([{ token, lifetime: 'transient', factory: resolver => {
            constructions++;
            if (constructions === 1) detached = (async () => { await released.promise; return resolver.resolve(token); })();
            return { [Symbol.dispose]: () => { disposals++; } };
        } }]);
        const scope = registry.createScope(context('alpha'));
        try {
            const first = await scope.resolve(token);
            released.release();
            const second = await beforeDeadline(detached, 'detached transient retry');
            should().not.equal(first, second);
            constructions.should.equal(2);
            await scope.dispose();
            disposals.should.equal(2);
        } finally { released.release(); await registry.dispose(); }
    });
    for (const throwingDisposer of [false, true]) {
        it(`invalidates result publication in the singleton failure gap (disposer throws: ${throwingDisposer})`, async () => {
            const partial = serviceToken<object>('partial singleton');
            const broken = serviceToken<object>('broken singleton');
            const inCompletion = gate(); const brokenEntered = gate(); const releaseBroken = gate(); const failureObserved = gate();
            const events: string[] = [];
            const server = new ArcServer({ services: [
                { token: partial, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => {
                    events.push('singleton disposed');
                    if (throwingDisposer) throw new Error('singleton cleanup failed');
                } }) },
                { token: broken, lifetime: 'singleton', factory: async () => {
                    brokenEntered.release();
                    await releaseBroken.promise;
                    throw new Error('singleton factory failed');
                } }
            ], queries: [
                defineQuery({ name: 'Successful', schema: z.object({}), perform: async () => {
                    await currentServices().resolve(partial);
                    return 'private data';
                } }),
                defineQuery({ name: 'Broken', schema: z.object({}), handlerDependencies: [broken], perform: () => 'unexpected' })
            ] });
            const registry = server.services;
            const run = registry.runExecution.bind(registry);
            registry.runExecution = <T>(callback: () => Promise<T>, completed?: (result: T, living: boolean) => Promise<T>): Promise<T> =>
                run(async () => {
                    const saved = await callback();
                    if (typeof saved === 'object' && saved !== null && 'data' in saved && saved.data === 'private data') {
                        inCompletion.release();
                        await brokenEntered.promise;
                        releaseBroken.release();
                        await failureObserved.promise;
                    }
                    return saved;
                }, completed);
            const mark = registry.markSingletonFailure.bind(registry);
            registry.markSingletonFailure = () => { mark(); failureObserved.release(); };
            try {
                const prepared = server.performQuery('Successful', {}, context('alpha'));
                await beforeDeadline(inCompletion.promise, 'successful completion intercepted');
                const failing = server.performQuery('Broken', {}, context('beta'));
                await beforeDeadline(failureObserved.promise, 'singleton failure observed');
                const success = await beforeDeadline(prepared, 'successful result invalidation');
                success.isSuccess.should.equal(false);
                should().equal(success.data, undefined);
                (success.exceptionMessages.join(' ')).should.match(/Service registry is disposed/);
                const failed = await beforeDeadline(failing, 'failed singleton shutdown');
                failed.isSuccess.should.equal(false);
                (failed.exceptionMessages.join(' ')).should.match(/Service factory failed: broken singleton/);
                const recorded = originalFailure(failed);
                const first: unknown = recorded instanceof AggregateError ? recorded.errors[0] : recorded;
                if (!(first instanceof Error)) throw new Error('Expected recorded factory error');
                String(first.cause).should.match(/singleton factory failed/);
                if (throwingDisposer) {
                    (success.exceptionMessages.join(' ')).should.match(/Service registry disposal failed/);
                    (failed.exceptionMessages.join(' ')).should.match(/Service registry disposal failed/);
                    (events).should.deep.equal(['singleton disposed']);
                    await shouldRejectWithError(registry.dispose(), /Service registry disposal failed/);
                } else {
                    (events).should.deep.equal(['singleton disposed']);
                    await registry.dispose();
                }
            } finally { releaseBroken.release(); }
        });
    }
    it('joins an already-closing scope before disposing singletons', async () => {
        const scoped = serviceToken<object>('closing scoped');
        const singleton = serviceToken<object>('closing singleton');
        const insideDisposer = gate(); const releaseDisposer = gate(); const joined = gate();
        const events: string[] = [];
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: 'scoped', factory: () => ({ [Symbol.asyncDispose]: async () => {
                insideDisposer.release(); await releaseDisposer.promise; events.push('scope disposed');
            } }) },
            { token: singleton, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); } }) }
        ]);
        const scope = registry.createScope(context('alpha'));
        const original = scope.dispose.bind(scope);
        scope.dispose = () => { joined.release(); return original(); };
        try {
            await scope.resolve(scoped);
            await scope.resolve(singleton);
            const closing = scope.dispose();
            scope.disposed.should.equal(true);
            await insideDisposer.promise;
            const shutdown = registry.dispose();
            const first = await beforeDeadline(Promise.race([
                joined.promise.then(() => 'joined'), shutdown.then(() => 'shutdown', () => 'shutdown')
            ]), 'registry joins closing scope');
            first.should.equal('joined');
            (events).should.deep.equal([]);
            releaseDisposer.release();
            await beforeDeadline(Promise.all([closing, shutdown]), 'scope before singleton shutdown');
            (events).should.deep.equal(['scope disposed', 'singleton disposed']);
        } finally { releaseDisposer.release(); await registry.dispose(); }
    });
    it('retains a closing scope in the shutdown snapshot while execution drainage is held', async () => {
        const scoped = serviceToken<object>('failing scoped cleanup');
        const singleton = serviceToken<object>('singleton cleanup');
        const started = gate(); const releaseExecution = gate();
        const insideDisposer = gate(); const releaseDisposer = gate();
        const events: string[] = [];
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: 'scoped', factory: () => ({ [Symbol.asyncDispose]: async () => {
                insideDisposer.release(); await releaseDisposer.promise;
                events.push('scope failed'); throw new Error('captured cleanup failure');
            } }) },
            { token: singleton, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); } }) }
        ]);
        const scope = registry.createScope(context('alpha'));
        try {
            await scope.resolve(scoped);
            await scope.resolve(singleton);
            const execution = registry.runExecution(async () => { started.release(); await releaseExecution.promise; });
            await started.promise;
            const closing = scope.dispose();
            await insideDisposer.promise;
            const shutdown = registry.dispose();
            should().equal(shutdown, registry.dispose());
            releaseDisposer.release();
            await shouldRejectWithError(beforeDeadline(closing, 'scope cleanup failure'), /Service disposal failed/);
            (events).should.deep.equal(['scope failed']);
            releaseExecution.release();
            await beforeDeadline(execution, 'execution drainage');
            const failure = await beforeDeadline(shutdown.then(() => undefined, error => error as unknown), 'captured failure shutdown');
            if (!(failure instanceof AggregateError)) throw new Error('Expected registry cleanup failure');
            failure.message.should.match(/Service registry disposal failed/);
            const scopeFailure: unknown = failure.errors[0];
            if (!(scopeFailure instanceof AggregateError)) throw new Error('Expected captured scope cleanup failure');
            (scopeFailure.errors[0] as Error).message.should.equal('captured cleanup failure');
            (events).should.deep.equal(['scope failed', 'singleton disposed']);
        } finally { releaseExecution.release(); releaseDisposer.release(); await shouldRejectWithError(registry.dispose(), /Service registry disposal failed/); }
    });
});
