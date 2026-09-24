// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, ServiceRegistry, Severity, currentContext, currentServices, defineCommand, defineQuery, serviceToken, validation } from '../../index.js';
import { ArcScenario, shouldHaveRuleFailure } from '@cratis/arc.testing';
import { shouldRejectWithError } from '../shouldRejectWithError.js';

should();
const context = (tenantId?: string) => ({ correlationId: crypto.randomUUID(), principal: undefined, tenantId, signal: new AbortController().signal, allowedSeverity: Severity.Warning });
async function beforeDeadline<T>(work: Promise<T>, name: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([work, new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error(`${name} hung`)), 1000);
        })]);
    } finally { if (timer) clearTimeout(timer); }
}

describe('owned service composition', () => {
    it('shares concurrent scoped/singleton in-flight factories but not transients or tenant state', async () => {
        const singleton = serviceToken<{ id: number }>('singleton');
        const scoped = serviceToken<{ tenant: string | undefined }>('scoped');
        const transient = serviceToken<object>('transient');
        let singleCalls = 0; let scopedCalls = 0; let transientCalls = 0;
        const registry = new ServiceRegistry([
            { token: singleton, lifetime: 'singleton', factory: async () => { singleCalls++; await Promise.resolve(); return { id: singleCalls }; } },
            { token: scoped, lifetime: 'scoped', factory: async (_resolver, identity) => { scopedCalls++; await Promise.resolve(); return { tenant: identity.tenantId }; } },
            { token: transient, lifetime: 'transient', factory: () => { transientCalls++; return {}; } }
        ]);
        const a = registry.createScope(context('a'));
        const b = registry.createScope(context('b'));
        const [a1, a2, b1, b2] = await Promise.all([a.resolve(scoped), a.resolve(scoped), b.resolve(scoped), b.resolve(scoped)]);
        should().equal(a1, a2);
        should().equal(b1, b2);
        should().not.equal(a1, b1);
        should().equal(a1?.tenant, 'a');
        should().equal(b1?.tenant, 'b');
        const [s1, s2] = await Promise.all([a.resolve(singleton), b.resolve(singleton)]);
        should().equal(s1, s2);
        should().not.equal(await a.resolve(transient), await a.resolve(transient));
        ([singleCalls, scopedCalls, transientCalls]).should.deep.equal([1, 2, 2]);
        await registry.dispose();
        await registry.dispose();
        await shouldRejectWithError(Promise.resolve().then(() => registry.createScope(context())), /disposed/);
    });
    it('keeps overlapping tenant pipelines and their scopes isolated', async () => {
        const tenant = serviceToken<{ tenantId: string | undefined }>('per execution tenant');
        const events: string[] = [];
        const server = new ArcServer({ services: [{ token: tenant, lifetime: 'scoped', factory: async (_resolver, identity) => {
            await Promise.resolve();
            return { tenantId: identity.tenantId, [Symbol.dispose]: () => { events.push(identity.tenantId ?? 'none'); } };
        } }], queries: [defineQuery({ name: 'Tenant', schema: z.object({}), handlerDependencies: [tenant],
            perform: async () => { await Promise.resolve(); return (await currentServices().resolve(tenant)).tenantId; } })] });
        const [a, b] = await Promise.all([server.performQuery('Tenant', {}, context('alpha')), server.performQuery('Tenant', {}, context('beta'))]);
        should().equal(a.data, 'alpha');
        should().equal(b.data, 'beta');
        (events.sort()).should.deep.equal(['alpha', 'beta']);
        await server.dispose();
    });
    it('uses a manually created scope identity inside an active scoped factory without relaxing singleton captivity', async () => {
        const outer = serviceToken<object>('outer scoped');
        const inner = serviceToken<{ tenant: string | undefined }>('manual tenant');
        const singleton = serviceToken<object>('manual singleton');
        const registry = new ServiceRegistry([
            { token: inner, lifetime: 'scoped', factory: (_resolver, identity) => ({ tenant: identity.tenantId }) },
            { token: outer, lifetime: 'scoped', factory: async () => {
                const beta = registry.createScope(context('beta'));
                try { should().equal((await beta.resolve(inner)).tenant, 'beta'); }
                finally { await beta.dispose(); }
                return {};
            } },
            { token: singleton, lifetime: 'singleton', factory: async () => {
                const beta = registry.createScope(context('beta'));
                try { await beta.resolve(inner); }
                finally { await beta.dispose(); }
                return {};
            } }
        ]);
        const alpha = registry.createScope(context('alpha'));
        await alpha.resolve(outer);
        await shouldRejectWithError(alpha.resolve(singleton), /Captive/);
        await registry.dispose();
    });
    it('resets factory resolution state at a nested execution boundary', async () => {
        const outer = serviceToken<object>('outer tenant');
        const inner = serviceToken<{ tenant: string | undefined }>('inner tenant');
        const server = new ArcServer({ services: [
            { token: outer, lifetime: 'scoped', factory: async () => {
                const nested = await server.performQuery('Inner', {}, context('beta'));
                nested.isSuccess.should.equal(true);
                should().equal(nested.data, 'beta');
                return {};
            } },
            { token: inner, lifetime: 'scoped', factory: (_resolver, identity) => ({ tenant: identity.tenantId }) }
        ], queries: [
            defineQuery({ name: 'Outer', schema: z.object({}), handlerDependencies: [outer], perform: () => 'done' }),
            defineQuery({ name: 'Inner', schema: z.object({}), handlerDependencies: [inner], perform: async () => {
                should().equal(currentContext()?.tenantId, 'beta');
                return (await currentServices().resolve(inner)).tenant;
            } })
        ] });
        const result = await server.performQuery('Outer', {}, context('alpha'));
        result.isSuccess.should.equal(true);
        should().equal(result.data, 'done');
        await server.dispose();
    });
    it('rejects recursive singleton resolution through a nested pipeline without hanging shutdown', async () => {
        const singleton = serviceToken<object>('recursive singleton');
        const events: string[] = [];
        const server = new ArcServer({ services: [{ token: singleton, lifetime: 'singleton', factory: async () => {
            events.push('factory entered');
            const nested = await server.performQuery('Recursive', {}, context('inner'));
            nested.isSuccess.should.equal(false);
            (nested.exceptionMessages.join(' ')).should.match(/Service dependency cycle: recursive singleton/);
            throw new Error('nested singleton failed');
        } }], queries: [defineQuery({ name: 'Recursive', schema: z.object({}), handlerDependencies: [singleton], perform: () => {
            events.push('handler');
            return 'unexpected';
        } })] });
        const result = await beforeDeadline(server.performQuery('Recursive', {}, context('outer')), 'recursive singleton shutdown');
        result.isSuccess.should.equal(false);
        should().equal(result.data, undefined);
        (events).should.deep.equal(['factory entered']);
        await beforeDeadline(server.dispose(), 'recursive singleton disposal');
    });
    it('allows a detached child to resolve a singleton after its factory and parent finish', async () => {
        const singleton = serviceToken<object>('completed singleton');
        let childEntered!: () => void;
        const entered = new Promise<void>(resolve => { childEntered = resolve; });
        let releaseChild!: () => void;
        const release = new Promise<void>(resolve => { releaseChild = resolve; });
        let child: Promise<Awaited<ReturnType<ArcServer['performQuery']>>> | undefined;
        let constructions = 0;
        const value = {};
        const server = new ArcServer({ services: [{ token: singleton, lifetime: 'singleton', factory: () => {
            constructions++;
            child = server.performQuery('Child', {}, context('child'));
            return value;
        } }], queries: [
            defineQuery({ name: 'Parent', schema: z.object({}), handlerDependencies: [singleton], perform: () => 'parent done' }),
            defineQuery({ name: 'Child', schema: z.object({}), perform: async () => {
                childEntered();
                await release;
                return (await currentServices().resolve(singleton)) === value;
            } })
        ] });
        try {
            const parentWork = server.performQuery('Parent', {}, context('parent'));
            await beforeDeadline(entered, 'detached child start');
            const parent = await beforeDeadline(parentWork, 'completed singleton parent');
            parent.isSuccess.should.equal(true);
            should().equal(parent.data, 'parent done');
            releaseChild();
            const result = await beforeDeadline(child!, 'completed singleton child');
            result.isSuccess.should.equal(true);
            should().equal(result.data, true);
            constructions.should.equal(1);
        } finally {
            releaseChild();
            await beforeDeadline(server.dispose(), 'completed singleton disposal');
        }
    });
    it('does not revive a failed attempt in a detached retry in the same scope', async () => {
        const token = serviceToken<{ tenant: string | undefined }>('retried scoped');
        let releaseRetry!: () => void;
        const retryGate = new Promise<void>(resolve => { releaseRetry = resolve; });
        let retry: Promise<{ tenant: string | undefined }> | undefined;
        let attempts = 0;
        const server = new ArcServer({ services: [{ token, lifetime: 'scoped', factory: (resolver, identity) => {
            attempts++;
            if (attempts === 1) {
                retry = (async () => { await retryGate; return resolver.resolve(token); })();
                throw new Error('first attempt failed');
            }
            return { tenant: identity.tenantId };
        } }], queries: [defineQuery({ name: 'Retry', schema: z.object({}), perform: async () => {
            await shouldRejectWithError(currentServices().resolve(token), /Service factory failed: retried scoped/);
            releaseRetry();
            return (await beforeDeadline(retry!, 'detached scoped retry')).tenant;
        } })] });
        try {
            const result = await beforeDeadline(server.performQuery('Retry', {}, context('alpha')), 'failed scoped retry');
            result.isSuccess.should.equal(true);
            should().equal(result.data, 'alpha');
            attempts.should.equal(2);
        } finally {
            releaseRetry();
            await beforeDeadline(server.dispose(), 'failed scoped retry disposal');
        }
    });
    it('detects singleton A through nested scoped B back to A without a false scoped cycle', async () => {
        const a = serviceToken<object>('singleton A');
        const b = serviceToken<object>('nested scoped B');
        const server = new ArcServer({ services: [
            { token: a, lifetime: 'singleton', factory: async () => {
                const nested = await server.performQuery('B', {}, context('nested'));
                nested.isSuccess.should.equal(false);
                (nested.exceptionMessages.join(' ')).should.match(/Service dependency cycle: singleton A/);
                throw new Error('nested dependency failed');
            } },
            { token: b, lifetime: 'scoped', factory: resolver => resolver.resolve(a) }
        ], queries: [
            defineQuery({ name: 'A', schema: z.object({}), handlerDependencies: [a], perform: () => 'unexpected' }),
            defineQuery({ name: 'B', schema: z.object({}), handlerDependencies: [b], perform: () => 'unexpected' })
        ] });
        const result = await beforeDeadline(server.performQuery('A', {}, context()), 'singleton A via nested B');
        result.isSuccess.should.equal(false);
        should().equal(result.data, undefined);
        await beforeDeadline(server.dispose(), 'singleton A nested B disposal');
    });
    it('allows the same scoped token in independent nested tenant executions', async () => {
        const tenant = serviceToken<{ id: string | undefined }>('nested tenant token');
        const calls: string[] = [];
        const server = new ArcServer({ services: [{ token: tenant, lifetime: 'scoped', factory: async (_resolver, identity) => {
            calls.push(identity.tenantId ?? 'none');
            if (identity.tenantId === 'alpha') {
                const nested = await server.performQuery('Tenant', {}, context('beta'));
                should().equal(nested.data, 'beta');
            }
            return { id: identity.tenantId };
        } }], queries: [defineQuery({ name: 'Tenant', schema: z.object({}), handlerDependencies: [tenant],
            perform: async () => (await currentServices().resolve(tenant)).id })] });
        const result = await beforeDeadline(server.performQuery('Tenant', {}, context('alpha')), 'independent scoped tenant resolution');
        should().equal(result.data, 'alpha');
        (calls).should.deep.equal(['alpha', 'beta']);
        await beforeDeadline(server.dispose(), 'independent scoped tenant disposal');
    });
    it('joins shutdown when an unawaited child singleton fails after its parent has finished', async () => {
        const partial = serviceToken<object>('late partial singleton');
        const broken = serviceToken<object>('late broken singleton');
        const events: string[] = [];
        let childStarted!: () => void;
        const started = new Promise<void>(resolve => { childStarted = resolve; });
        let releaseChild!: () => void;
        const release = new Promise<void>(resolve => { releaseChild = resolve; });
        let child: Promise<Awaited<ReturnType<ArcServer['performQuery']>>> | undefined;
        const server = new ArcServer({ services: [
            { token: partial, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('partial disposed'); throw new Error('late cleanup failed'); } }) },
            { token: broken, lifetime: 'singleton', dependencies: [partial], factory: async resolver => {
                await resolver.resolve(partial);
                childStarted();
                await release;
                throw new Error('late factory failed');
            } }
        ], queries: [
            defineQuery({ name: 'Parent', schema: z.object({}), perform: () => {
                child = server.performQuery('Child', {}, context('child'));
                return 'parent finished';
            } }),
            defineQuery({ name: 'Child', schema: z.object({}), handlerDependencies: [broken], perform: () => {
                events.push('child handler');
                return 'unexpected';
            } })
        ] });
        try {
            const parentResult = server.performQuery('Parent', {}, context('parent'));
            await beforeDeadline(started, 'late child factory start');
            const parent = await beforeDeadline(parentResult, 'late parent completion');
            should().equal(parent.data, 'parent finished');
            releaseChild();
            const result = await beforeDeadline(child!, 'late child shutdown');
            result.isSuccess.should.equal(false);
            should().equal(result.data, undefined);
            (result.exceptionMessages.join(' ')).should.match(/Service registry disposal failed/);
            (events).should.deep.equal(['partial disposed']);
        } finally {
            releaseChild();
            await shouldRejectWithError(beforeDeadline(server.dispose(), 'late child disposal'), /Service registry disposal failed/);
        }
    });
    it('leaves cleanup to a living grandparent when the intermediate parent has finished', async () => {
        const partial = serviceToken<object>('grandchild partial singleton');
        const broken = serviceToken<object>('grandchild broken singleton');
        const events: string[] = [];
        let started!: () => void;
        const childStarted = new Promise<void>(resolve => { started = resolve; });
        let release!: () => void;
        const childRelease = new Promise<void>(resolve => { release = resolve; });
        let parentFinished!: () => void;
        const parentDone = new Promise<void>(resolve => { parentFinished = resolve; });
        let child: Promise<Awaited<ReturnType<ArcServer['performQuery']>>> | undefined;
        const server = new ArcServer({ services: [
            { token: partial, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('partial disposed'); throw new Error('grandchild cleanup failed'); } }) },
            { token: broken, lifetime: 'singleton', dependencies: [partial], factory: async resolver => {
                await resolver.resolve(partial);
                started();
                await childRelease;
                throw new Error('grandchild factory failed');
            } }
        ], queries: [
            defineQuery({ name: 'Grandparent', schema: z.object({}), perform: async () => {
                const parent = await server.performQuery('Parent', {}, context('parent'));
                should().equal(parent.data, 'parent done');
                parentFinished();
                const inner = await child!;
                inner.isSuccess.should.equal(false);
                (events).should.deep.equal([]);
                return 'must not succeed';
            } }),
            defineQuery({ name: 'Parent', schema: z.object({}), perform: () => {
                child = server.performQuery('Child', {}, context('child'));
                return 'parent done';
            } }),
            defineQuery({ name: 'Child', schema: z.object({}), handlerDependencies: [broken], perform: () => {
                events.push('child handler');
                return 'unexpected';
            } })
        ] });
        try {
            const grandparent = server.performQuery('Grandparent', {}, context('grandparent'));
            await beforeDeadline(childStarted, 'grandchild factory start');
            await beforeDeadline(parentDone, 'intermediate parent completion');
            release();
            const result = await beforeDeadline(grandparent, 'grandparent shutdown');
            result.isSuccess.should.equal(false);
            should().equal(result.data, undefined);
            (result.exceptionMessages.join(' ')).should.match(/Service registry disposal failed/);
            (events).should.deep.equal(['partial disposed']);
        } finally {
            release();
            await shouldRejectWithError(beforeDeadline(server.dispose(), 'grandparent disposal'), /Service registry disposal failed/);
        }
    });
    it('preflights handler graph without constructing during validation and disposes in reverse order', async () => {
        const calls: string[] = [];
        const dependency = serviceToken<object>('dependency');
        const handler = serviceToken<object>('handler');
        const server = new ArcServer({ services: [
            { token: dependency, lifetime: 'scoped', factory: () => { calls.push('dependency'); return { [Symbol.asyncDispose]: async () => { calls.push('dispose dependency'); } }; } },
            { token: handler, lifetime: 'scoped', dependencies: [dependency], factory: async resolver => { await resolver.resolve(dependency); calls.push('handler'); return { [Symbol.dispose]: () => { calls.push('dispose handler'); } }; } }
        ], commands: [defineCommand({ name: 'Save', schema: z.object({}), handlerDependencies: [handler],
            validate: () => { calls.push('validate'); return []; },
            scopes: [() => ({ begin: () => { calls.push('begin'); }, complete: () => { calls.push('complete'); } })],
            provide: () => { calls.push('provide'); return 1; }, handle: () => { calls.push('handle'); return 2; } })] });
        (await server.executeCommand('Save', {}, context(), true)).isSuccess.should.equal(true);
        (calls).should.deep.equal(['validate']);
        should().equal((await server.executeCommand('Save', {}, context())).response, 2);
        (calls).should.deep.equal(['validate', 'validate', 'dependency', 'handler', 'begin', 'provide', 'handle', 'complete', 'dispose handler', 'dispose dependency']);
        await server.dispose();
    });
    it('fails closed for missing, cyclic and captive dependencies before handler effects', async () => {
        const missing = serviceToken<object>('missing');
        const cycleA = serviceToken<object>('cycle A');
        const cycleB = serviceToken<object>('cycle B');
        const singleton = serviceToken<object>('singleton');
        const scoped = serviceToken<object>('scoped');
        const calls: string[] = [];
        const server = new ArcServer({ services: [
            { token: cycleA, lifetime: 'scoped', dependencies: [cycleB], factory: () => ({}) },
            { token: cycleB, lifetime: 'scoped', dependencies: [cycleA], factory: () => ({}) },
            { token: singleton, lifetime: 'singleton', dependencies: [scoped], factory: () => ({}) },
            { token: scoped, lifetime: 'scoped', factory: () => ({}) }
        ], commands: [missing, cycleA, singleton].map((token, index) => defineCommand({ name: `Action${index}`, schema: z.object({}), handlerDependencies: [token],
            validate: () => { calls.push('validate'); return []; }, provide: () => { calls.push('provide'); }, handle: () => { calls.push('handle'); } })) });
        for (let i = 0; i < 3; i++) {
            const result = await server.executeCommand(`Action${i}`, {}, context(), true);
            should().equal(result.validationResults[0]?.reason, 'dependencyUnavailable');
            result.isSuccess.should.equal(false);
        }
        (calls).should.deep.equal([]);
        await server.dispose();
    });
    it('cleans an owned manually created scope after a top-level factory rejection', async () => {
        const calls: string[] = [];
        const partial = serviceToken<object>('partial');
        const failure = serviceToken<object>('failure');
        const registry = new ServiceRegistry([
            { token: partial, lifetime: 'scoped', factory: () => ({ [Symbol.dispose]: () => { calls.push('disposed'); } }) },
            { token: failure, lifetime: 'scoped', dependencies: [partial], factory: async resolver => {
                await resolver.resolve(partial);
                throw new Error('failed');
            } }
        ]);
        const scope = registry.createScope(context());
        await shouldRejectWithError(scope.resolve(failure), /factory failed/);
        (calls).should.deep.equal(['disposed']);
        scope.disposed.should.equal(true);
        await registry.dispose();
    });
    it('disposes partial graph after factory failures and clears response after disposal failure', async () => {
        const events: string[] = [];
        const first = serviceToken<object>('first');
        const last = serviceToken<object>('last');
        const server = new ArcServer({ services: [
            { token: first, lifetime: 'scoped', factory: () => ({ [Symbol.asyncDispose]: async () => { events.push('first disposed'); } }) },
            { token: last, lifetime: 'scoped', dependencies: [first], factory: async resolver => { await resolver.resolve(first); throw new Error('factory failed'); } }
        ], commands: [defineCommand({ name: 'Fail', schema: z.object({}), handlerDependencies: [last], handle: () => { events.push('handle'); return 1; } })] });
        const failed = await server.executeCommand('Fail', {}, context());
        failed.isSuccess.should.equal(false);
        should().equal(failed.validationResults[0]?.reason, 'dependencyUnavailable');
        (events).should.deep.equal(['first disposed']);
        await server.dispose();
        const broken = serviceToken<object>('broken');
        const other = new ArcServer({ services: [{ token: broken, lifetime: 'scoped', factory: () => ({ [Symbol.asyncDispose]: async () => { throw new Error('dispose failed'); } }) }],
            commands: [defineCommand({ name: 'Reply', schema: z.object({}), handlerDependencies: [broken], handle: () => 'secret' })] });
        const result = await other.executeCommand('Reply', {}, context());
        result.isSuccess.should.equal(false);
        should().equal(result.response, undefined);
        (result.exceptionMessages[0] ?? '').should.match(/disposal failed/);
        await other.dispose();
    });
    it('disposes services after aborted validation, invalid results and a failing command scope', async () => {
        const events: string[] = [];
        const validator = serviceToken<object>('validator');
        const handler = serviceToken<object>('handler');
        const server = new ArcServer({ services: [
            { token: validator, lifetime: 'scoped', factory: () => ({ [Symbol.dispose]: () => { events.push('validator disposed'); } }) },
            { token: handler, lifetime: 'scoped', factory: () => ({ [Symbol.dispose]: () => { events.push('handler disposed'); } }) }
        ], commands: [
            defineCommand({ name: 'Invalid', schema: z.object({}), validatorDependencies: [validator], handlerDependencies: [handler],
                validate: () => [validation('no', [], 'rule', Severity.Error)], handle: () => { events.push('unexpected'); } }),
            defineCommand({ name: 'Scope', schema: z.object({}), handlerDependencies: [handler],
                scopes: [() => ({ begin: () => { throw new Error('scope failed'); }, complete: () => { events.push('complete'); } })],
                handle: () => { events.push('unexpected'); } }),
            defineCommand({ name: 'Abort', schema: z.object({}), validatorDependencies: [validator],
                validate: (_input, execution) => { if (execution.signal.aborted) throw new Error('aborted'); return []; }, handle: () => { events.push('unexpected'); } })
        ] });
        (await server.executeCommand('Invalid', {}, context())).isValid.should.equal(false);
        (events).should.deep.equal(['validator disposed']);
        (await server.executeCommand('Scope', {}, context())).hasExceptions.should.equal(true);
        (events).should.deep.equal(['validator disposed', 'complete', 'handler disposed']);
        const cancelled = new AbortController();
        cancelled.abort();
        (await server.executeCommand('Abort', {}, { ...context(), signal: cancelled.signal })).isSuccess.should.equal(false);
        (events).should.deep.equal(['validator disposed', 'complete', 'handler disposed', 'validator disposed']);
        await server.dispose();
    });
    it('rejects dynamic cycles and captive resolutions even when a factory omits declarations', async () => {
        const recursive = serviceToken<object>('recursive');
        const scoped = serviceToken<object>('scoped');
        const singleton = serviceToken<object>('singleton');
        const registry = new ServiceRegistry([
            { token: recursive, lifetime: 'scoped', factory: resolver => resolver.resolve(recursive) },
            { token: scoped, lifetime: 'scoped', factory: () => ({}) },
            { token: singleton, lifetime: 'singleton', factory: resolver => resolver.resolve(scoped) }
        ]);
        const scope = registry.createScope(context());
        await shouldRejectWithError(scope.resolve(recursive), /cycle/);
        const another = registry.createScope(context());
        await shouldRejectWithError(another.resolve(singleton), /Captive/);
        await registry.dispose();
    });
    it('rejects ambient scoped resolution inside a singleton factory across tenant executions', async () => {
        const scoped = serviceToken<{ tenant: string | undefined }>('tenant dependency');
        const singleton = serviceToken<{ tenant: string | undefined }>('tenant capture');
        let scopedCalls = 0;
        const server = new ArcServer({ services: [
            { token: scoped, lifetime: 'scoped', factory: (_resolver, identity) => { scopedCalls++; return { tenant: identity.tenantId }; } },
            { token: singleton, lifetime: 'singleton', factory: async () => ({ tenant: (await currentServices().resolve(scoped)).tenant }) }
        ], queries: [defineQuery({ name: 'CapturedTenant', schema: z.object({}), handlerDependencies: [singleton],
            perform: async () => (await currentServices().resolve(singleton)).tenant })] });
        const alpha = await server.performQuery('CapturedTenant', {}, context('alpha'));
        alpha.isSuccess.should.equal(false);
        should().equal(alpha.data, undefined);
        scopedCalls.should.equal(0);
        await shouldRejectWithError(server.performQuery('CapturedTenant', {}, context('beta')), /disposed/);
        await server.dispose();
    });
    it('detects a cycle between concurrently resolving factories without deadlocking', async () => {
        const a = serviceToken<object>('a');
        const b = serviceToken<object>('b');
        const registry = new ServiceRegistry([
            { token: a, lifetime: 'scoped', factory: async resolver => { await Promise.resolve(); return resolver.resolve(b); } },
            { token: b, lifetime: 'scoped', factory: async resolver => { await Promise.resolve(); return resolver.resolve(a); } }
        ]);
        const scope = registry.createScope(context());
        const results = await Promise.allSettled([scope.resolve(a), scope.resolve(b)]);
        (results.map(result => result.status)).should.deep.equal(['rejected', 'rejected']);
        await registry.dispose();
    });
    it('disposes singleton partial graphs on factory failure and rejects subsequent requests', async () => {
        const events: string[] = [];
        const first = serviceToken<object>('first singleton');
        const broken = serviceToken<object>('broken singleton');
        const server = new ArcServer({ services: [
            { token: first, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('disposed'); } }) },
            { token: broken, lifetime: 'singleton', dependencies: [first], factory: async resolver => { await resolver.resolve(first); throw new Error('no singleton'); } }
        ], queries: [defineQuery({ name: 'Broken', schema: z.object({}), handlerDependencies: [broken], perform: () => 1 })] });
        const result = await server.performQuery('Broken', {}, context());
        result.isSuccess.should.equal(false);
        (events).should.deep.equal(['disposed']);
        await shouldRejectWithError(server.performQuery('Broken', {}, context()), /disposed/);
        await server.dispose();
    });
    it('drains overlapping executions on singleton failure without disposing a running handler or reporting success', async () => {
        const active = serviceToken<object>('active');
        const broken = serviceToken<object>('broken');
        const events: string[] = [];
        let entered!: () => void;
        const running = new Promise<void>(resolve => { entered = resolve; });
        let resume!: () => void;
        const wait = new Promise<void>(resolve => { resume = resolve; });
        const server = new ArcServer({ services: [
            { token: active, lifetime: 'scoped', factory: () => ({ [Symbol.dispose]: () => { events.push('disposed'); } }) },
            { token: broken, lifetime: 'singleton', factory: () => { throw new Error('failed'); } }
        ], queries: [
            defineQuery({ name: 'Slow', schema: z.object({}), handlerDependencies: [active], perform: async () => {
                entered();
                await wait;
                events.push('resumed');
                return 'sensitive';
            } }),
            defineQuery({ name: 'Broken', schema: z.object({}), handlerDependencies: [broken], perform: () => 1 })
        ] });
        let failed!: () => void;
        const singletonFailure = new Promise<void>(resolve => { failed = resolve; });
        const markFailure = server.services.markSingletonFailure.bind(server.services);
        server.services.markSingletonFailure = () => { markFailure(); failed(); };
        const slow = server.performQuery('Slow', {}, context());
        await running;
        const failure = server.performQuery('Broken', {}, context());
        await beforeDeadline(singletonFailure, 'concurrent singleton failure signal');
        server.services.singletonFailed.should.equal(true);
        (events).should.deep.equal([]);
        await shouldRejectWithError(server.performQuery('Slow', {}, context()), /disposed/);
        resume();
        const result = await slow;
        result.isSuccess.should.equal(false);
        should().equal(result.data, undefined);
        (events).should.deep.equal(['resumed', 'disposed']);
        (await failure).isSuccess.should.equal(false);
        await server.dispose();
    });
    it('unwinds a nested singleton failure before shutdown and reports cleanup errors', async () => {
        const active = serviceToken<object>('outer active');
        const partial = serviceToken<object>('inner partial singleton');
        const broken = serviceToken<object>('inner broken singleton');
        const events: string[] = [];
        const server = new ArcServer({ services: [
            { token: active, lifetime: 'scoped', factory: () => ({ [Symbol.dispose]: () => { events.push('outer disposed'); } }) },
            { token: partial, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('singleton disposed'); throw new Error('cleanup failed'); } }) },
            { token: broken, lifetime: 'singleton', dependencies: [partial], factory: async resolver => {
                await resolver.resolve(partial);
                throw new Error('singleton failed');
            } }
        ], queries: [
            defineQuery({ name: 'Outer', schema: z.object({}), handlerDependencies: [active], perform: async () => {
                const inner = await server.performQuery('Inner', {}, context('beta'));
                inner.isSuccess.should.equal(false);
                events.push('inner returned');
                return 'sensitive';
            } }),
            defineQuery({ name: 'Inner', schema: z.object({}), handlerDependencies: [broken], perform: () => 'unexpected' })
        ] });
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
            const result = await Promise.race([
                server.performQuery('Outer', {}, context('alpha')),
                new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error('nested shutdown deadlocked')), 1000); })
            ]);
            result.isSuccess.should.equal(false);
            should().equal(result.data, undefined);
            (result.exceptionMessages.join(' ')).should.match(/Service registry disposal failed/);
            (events).should.deep.equal(['inner returned', 'outer disposed', 'singleton disposed']);
        } finally {
            if (timer) clearTimeout(timer);
            await shouldRejectWithError(server.dispose(), /Service registry disposal failed/);
        }
    });
    it('does not take ownership of singleton aliases or caller-owned instances', async () => {
        const original = serviceToken<object>('singleton original');
        const alias = serviceToken<object>('scoped alias');
        const supplied = serviceToken<object>('caller-owned');
        const suppliedAlias = serviceToken<object>('caller alias');
        const calls: string[] = [];
        const provided = { [Symbol.dispose]: () => { calls.push('caller'); } };
        const server = new ArcServer({ services: [
            { token: original, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { calls.push('singleton'); } }) },
            { token: alias, lifetime: 'scoped', dependencies: [original], factory: resolver => resolver.resolve(original) },
            { token: supplied, lifetime: 'singleton', instance: provided },
            { token: suppliedAlias, lifetime: 'scoped', dependencies: [supplied], factory: resolver => resolver.resolve(supplied) }
        ], queries: [defineQuery({ name: 'Aliases', schema: z.object({}), handlerDependencies: [alias, suppliedAlias], perform: () => true })] });
        (await server.performQuery('Aliases', {}, context())).isSuccess.should.equal(true);
        (calls).should.deep.equal([]);
        await server.dispose();
        (calls).should.deep.equal(['singleton']);
    });
    it('rejects a shared scoped object before a second scope can take ownership', async () => {
        const token = serviceToken<object>('shared scoped object');
        let disposals = 0;
        const shared = { [Symbol.dispose]: () => { disposals++; } };
        const registry = new ServiceRegistry([{ token, lifetime: 'scoped', factory: () => shared }]);
        const first = registry.createScope(context());
        const second = registry.createScope(context());
        should().equal(await first.resolve(token), shared);
        await shouldRejectWithError(second.resolve(token), /Conflicting service ownership/);
        await registry.dispose();
        disposals.should.equal(1);
    });
    it('isolates validation-only and denied HTTP requests from handler factories', async () => {
        const events: string[] = [];
        const validator = serviceToken<object>('validator');
        const handler = serviceToken<object>('handler');
        const server = new ArcServer({ services: [
            { token: validator, lifetime: 'scoped', factory: () => { events.push('validator'); return { [Symbol.dispose]: () => { events.push('validator disposed'); } }; } },
            { token: handler, lifetime: 'scoped', factory: () => { events.push('handler'); return {}; } }
        ], commands: [defineCommand({ name: 'Submit', schema: z.object({}), authorization: { authenticated: true },
            handlerDependencies: [handler], validatorDependencies: [validator],
            validate: () => { events.push('validate'); return []; }, handle: () => { events.push('handle'); return 1; } })] });
        const url = 'http://localhost/api/submit/validate';
        const denied = await server.handle(new Request(url, { method: 'POST', body: '{}' }));
        should().equal(denied?.status, 403);
        (events).should.deep.equal([]);
        const allowed = await server.executeCommand('Submit', {}, { ...context(), principal: { id: 'a', isAuthenticated: true, roles: [] } }, true);
        allowed.isSuccess.should.equal(true);
        (events).should.deep.equal(['validator', 'validate', 'validator disposed']);
        const http = new ArcServer({ services: [{ token: handler, lifetime: 'scoped', factory: () => { events.push('http factory'); return {}; } }],
            commands: [defineCommand({ name: 'Submit', schema: z.object({}), handlerDependencies: [handler], handle: () => { events.push('http handle'); return 1; } })] });
        const response = await http.handle(new Request(url, { method: 'POST', body: '{}' }));
        should().equal(response?.status, 200);
        (events).should.deep.equal(['validator', 'validate', 'validator disposed']);
        await http.dispose();
        await server.dispose();
    });
    it('preserves caller-owned instances and identifies dynamic failures separately from authored rules', async () => {
        const owned = serviceToken<{ close: () => void }>('external');
        const absent = serviceToken<object>('absent');
        let disposed = false;
        const scenario = new ArcScenario({ services: [{ token: owned, lifetime: 'singleton', instance: { close: () => { disposed = true; }, [Symbol.dispose]: () => { disposed = true; } } }],
            commands: [defineCommand({ name: 'Rule', schema: z.object({}), validate: () => [validation('bad', ['name'], 'rule', Severity.Error)], handle: () => 1 }),
                defineCommand({ name: 'Dynamic', schema: z.object({}), validate: async () => { await currentServices().resolve(absent); return []; }, handle: () => 1 })],
            queries: [defineQuery({ name: 'Value', schema: z.object({}), perform: () => currentServices().resolve(owned).then(value => Boolean(value)) })] } as unknown as ConstructorParameters<typeof ArcScenario>[0]);
        const rule = await scenario.executeCommand('Rule', {}, { correlationId: 'test-id' });
        shouldHaveRuleFailure(rule, { reason: 'rule', member: 'name', severity: 3, correlationId: 'test-id' });
        const dependency = await scenario.executeCommand('Dynamic', {});
        should().equal(dependency.validationResults[0]?.reason, 'dependencyUnavailable');
        (() => shouldHaveRuleFailure(dependency, { reason: 'rule' })).should.throw();
        should().equal((await scenario.performQuery('Value', {})).data, true);
        await scenario.dispose();
        disposed.should.equal(false);
        (() => currentServices()).should.throw(/No live/);
    });
});
