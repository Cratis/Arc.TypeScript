// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, expectTypeOf, it, should } from 'vitest';
import { z } from 'zod';
import * as publicApi from '../src/index.js';
import { ArcServer, ServiceRegistry, ServiceScope, Severity, currentContext, currentServices, defineCommand, defineQuery, serviceToken } from '../src/index.js';
import { shouldRejectWithError } from './shouldRejectWithError.js';
import type { ExecutionContext } from '../src/ExecutionContext.js';

should();
const context = (tenantId: string) => ({ correlationId: crypto.randomUUID(), principal: { id: tenantId, roles: [tenantId], isAuthenticated: true }, tenantId, signal: new AbortController().signal, allowedSeverity: Severity.Warning });
function gate(): { promise: Promise<void>; release: () => void } {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}
async function beforeDeadline<T>(work: Promise<T>, name: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([work, new Promise<never>((_resolve, reject) => { timer = setTimeout(() => reject(new Error(`${name} hung`)), 1000); })]);
    } finally { if (timer) clearTimeout(timer); }
}

describe('registry-owned factories and graceful shutdown', () => {
    it('keeps a shared singleton alive across canceled callers without carrying request authority', async () => {
        const token = serviceToken<object>('shared');
        const entered = gate(); const release = gate();
        const canceled = new AbortController();
        const alpha = { ...context('alpha'), signal: canceled.signal }; const beta = context('beta');
        const seen: unknown[] = []; let creations = 0;
        const registry = new ServiceRegistry([{ token, lifetime: 'singleton', factory: async (resolver, lifetime) => {
            creations++;
            seen.push(lifetime, currentContext(), resolver.identity, currentServices().identity);
            Object.isFrozen(lifetime).should.equal(true);
            should().equal(lifetime, registry.singletonContext);
            lifetime.signal.aborted.should.equal(false);
            should().not.equal(lifetime.signal, alpha.signal);
            should().not.equal(lifetime.signal, beta.signal);
            entered.release(); await release.promise;
            seen.push(currentContext());
            return {};
        } }]);
        const first = registry.createScope(alpha); const second = registry.createScope(beta);
        try {
            const a = first.resolve(token); await entered.promise;
            canceled.abort();
            const b = second.resolve(token);
            release.release();
            should().equal(await a, await b);
            creations.should.equal(1);
            (seen[0] as { signal: AbortSignal }).signal.should.equal(registry.singletonContext.signal);
            seen.slice(1).should.deep.equal([undefined, undefined, undefined, undefined]);
            registry.singletonFailed.should.equal(false);
        } finally { release.release(); await registry.dispose(); }
    });
    it('keeps an abandoned original factory owned through shutdown and disposes it exactly once', async () => {
        const token = serviceToken<object>('abandoned');
        const entered = gate(); const release = gate(); let disposals = 0;
        const registry = new ServiceRegistry([{ token, lifetime: 'singleton', factory: async () => {
            entered.release(); await release.promise;
            return { [Symbol.dispose]: () => { disposals++; } };
        } }]);
        const scope = registry.createScope(context('alpha'));
        try {
            void scope.resolve(token).catch(() => {});
            await entered.promise;
            const closing = registry.dispose();
            let finished = false;
            void closing.then(() => { finished = true; });
            await Promise.resolve();
            finished.should.equal(false);
            release.release();
            await beforeDeadline(closing, 'abandoned factory shutdown');
            disposals.should.equal(1);
        } finally { release.release(); await registry.dispose(); }
    });
    it('allows committed work to resolve dependencies during draining without accepting new work', async () => {
        const late = serviceToken<object>('late dependency');
        const started = gate(); const release = gate(); let effects = 0;
        const server = new ArcServer({ services: [{ token: late, lifetime: 'scoped', factory: () => ({}) }], commands: [
            defineCommand({ name: 'Commit', schema: z.object({}), handle: async () => {
                effects++; started.release(); await release.promise;
                await currentServices().resolve(late);
                return 'committed';
            } })
        ] });
        try {
            const work = server.executeCommand('Commit', {}, context('alpha'));
            await started.promise;
            const closing = server.dispose();
            await shouldRejectWithError(server.executeCommand('Commit', {}, context('beta')), /disposed/);
            await shouldRejectWithError(Promise.resolve().then(() => server.services.createScope(context('manual'))), /disposed/);
            await shouldRejectWithError(Promise.resolve().then(() => new ServiceScope(server.services, context('direct'))), /disposed/);
            release.release();
            const result = await beforeDeadline(work, 'committed command');
            result.isSuccess.should.equal(true);
            should().equal(result.response, 'committed');
            effects.should.equal(1);
            await beforeDeadline(closing, 'committed shutdown');
        } finally { release.release(); await server.dispose(); }
    });
    it('does not rewrite a committed response for a later host shutdown failure', async () => {
        const failing = serviceToken<object>('host cleanup');
        const entered = gate(); const release = gate();
        const server = new ArcServer({ services: [{ token: failing, lifetime: 'scoped', factory: () => ({
            [Symbol.dispose]: () => { throw new Error('host teardown failed'); }
        }) }], commands: [defineCommand({ name: 'Commit', schema: z.object({}), handle: async () => {
            entered.release(); await release.promise; return 'committed';
        } })] });
        const manual = server.services.createScope(context('host'));
        try {
            await manual.resolve(failing);
            const work = server.executeCommand('Commit', {}, context('caller'));
            await entered.promise;
            const shutdown = server.dispose();
            release.release();
            const result = await beforeDeadline(work, 'committed host result');
            result.isSuccess.should.equal(true);
            should().equal(result.response, 'committed');
            await shouldRejectWithError(beforeDeadline(shutdown, 'host cleanup failure'), /Service registry disposal failed/);
        } finally { release.release(); await shouldRejectWithError(server.dispose(), /Service registry disposal failed/); }
    });
    it('rejects nested admission after shutdown while draining previously admitted detached children', async () => {
        const entered = gate(); const release = gate(); let child!: Promise<Awaited<ReturnType<ArcServer['performQuery']>>>;
        const server = new ArcServer({ queries: [
            defineQuery({ name: 'Parent', schema: z.object({}), perform: () => {
                child = server.performQuery('Child', {}, context('child'));
                return 'parent';
            } }),
            defineQuery({ name: 'Child', schema: z.object({}), perform: async () => {
                entered.release(); await release.promise;
                await shouldRejectWithError(server.performQuery('Child', {}, context('nested')), /disposed/);
                return 'child';
            } })
        ] });
        try {
            const parent = await server.performQuery('Parent', {}, context('parent'));
            parent.isSuccess.should.equal(true);
            await entered.promise;
            const closing = server.dispose();
            release.release();
            (await beforeDeadline(child, 'detached child')).isSuccess.should.equal(true);
            await beforeDeadline(closing, 'detached child shutdown');
        } finally { release.release(); await server.dispose(); }
    });
    it('lets only living factory attempts resolve from closing scopes and retains root signal ordering', async () => {
        const scoped = serviceToken<object>('scoped'); const singleton = serviceToken<object>('singleton');
        const entered = gate(); const release = gate(); const events: string[] = [];
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: 'scoped', factory: async resolver => {
                entered.release(); await release.promise;
                await resolver.resolve(singleton);
                return {};
            } },
            { token: singleton, lifetime: 'singleton', factory: (_resolver, lifetime) => ({
                [Symbol.dispose]: () => { lifetime.signal.aborted.should.equal(true); events.push('disposed'); }
            }) }
        ]);
        const scope = registry.createScope(context('alpha'));
        try {
            const work = scope.resolve(scoped);
            await entered.promise;
            const closing = scope.dispose();
            await shouldRejectWithError(Promise.resolve().then(() => scope.resolve(singleton)), /disposed/);
            const shutdown = registry.dispose();
            registry.singletonContext.signal.aborted.should.equal(false);
            release.release();
            await beforeDeadline(work, 'closing scoped factory');
            await beforeDeadline(Promise.all([closing, shutdown]), 'closing scoped shutdown');
            events.should.deep.equal(['disposed']);
            await shouldRejectWithError(Promise.resolve().then(() => scope.resolve(singleton)), /disposed/);
        } finally { release.release(); await registry.dispose(); }
    });
    it('does not revive closing scopes through detached settled factory ancestry', async () => {
        const origin = serviceToken<object>('settled owner'); const dependency = serviceToken<object>('late dependency');
        const release = gate(); let detached!: Promise<void>;
        const registry = new ServiceRegistry([
            { token: origin, lifetime: 'scoped', factory: resolver => {
                detached = (async () => {
                    await release.promise;
                    await shouldRejectWithError(Promise.resolve().then(() => resolver.resolve(dependency)), /disposed/);
                    (() => currentServices()).should.throw(/No live/);
                })();
                return {};
            } },
            { token: dependency, lifetime: 'scoped', factory: () => ({}) }
        ]);
        const scope = registry.createScope(context('alpha'));
        try {
            await scope.resolve(origin);
            await scope.dispose();
            release.release();
            await beforeDeadline(detached, 'settled ancestry');
        } finally { release.release(); await registry.dispose(); }
    });
    it('keeps root construction dependencies available until quiescence and aborts before disposal', async () => {
        const origin = serviceToken<object>('origin'); const dependency = serviceToken<object>('dependency');
        const entered = gate(); const release = gate(); const events: string[] = [];
        const registry = new ServiceRegistry([
            { token: dependency, lifetime: 'singleton', factory: (_resolver, lifetime) => ({
                [Symbol.dispose]: () => { lifetime.signal.aborted.should.equal(true); events.push('dependency'); }
            }) },
            { token: origin, lifetime: 'singleton', factory: async (resolver, lifetime) => {
                entered.release(); await release.promise;
                lifetime.signal.aborted.should.equal(false);
                await resolver.resolve(dependency);
                return { [Symbol.dispose]: () => { lifetime.signal.aborted.should.equal(true); events.push('origin'); } };
            } }
        ]);
        const scope = registry.createScope(context('alpha'));
        try {
            const work = scope.resolve(origin); await entered.promise;
            const shutdown = registry.dispose();
            registry.singletonContext.signal.aborted.should.equal(false);
            release.release();
            await beforeDeadline(work, 'root dependency');
            await beforeDeadline(shutdown, 'root shutdown');
            events.should.deep.equal(['origin', 'dependency']);
        } finally { release.release(); await registry.dispose(); }
    });
    it('avoids joining a detached singleton ancestor after its originating frame drains', async () => {
        const token = serviceToken<object>('detached root'); const broken = serviceToken<object>('nested failure');
        const entered = gate(); const release = gate(); let child!: Promise<Awaited<ReturnType<ArcServer['performQuery']>>>;
        const server = new ArcServer({ services: [
            { token, lifetime: 'singleton', factory: async () => {
                entered.release(); await release.promise;
                child = server.performQuery('Broken', {}, context('nested'));
                const outcome = await child;
                outcome.isSuccess.should.equal(false);
                throw new Error('root failed after nested');
            } },
            { token: broken, lifetime: 'scoped', factory: () => { throw new Error('nested failed'); } }
        ], queries: [
            defineQuery({ name: 'Start', schema: z.object({}), perform: () => {
                void currentServices().resolve(token).catch(() => {});
                return 'started';
            } }),
            defineQuery({ name: 'Broken', schema: z.object({}), handlerDependencies: [broken], perform: () => 'unexpected' })
        ] });
        try {
            const started = await server.performQuery('Start', {}, context('parent'));
            started.isSuccess.should.equal(true);
            await entered.promise;
            release.release();
            await beforeDeadline(child, 'detached nested failure');
            await beforeDeadline(server.dispose(), 'detached root shutdown');
            server.services.singletonFailed.should.equal(true);
        } finally { release.release(); await server.dispose(); }
    });
    it('rejects public shutdown from a handler or disposer instead of awaiting itself', async () => {
        const token = serviceToken<object>('disposer');
        const registry = new ServiceRegistry([{ token, lifetime: 'scoped', factory: () => ({
            [Symbol.asyncDispose]: async () => { await shouldRejectWithError(registry.dispose(), /Cannot await/); }
        }) }]);
        const server = new ArcServer({ services: registry, queries: [defineQuery({ name: 'Self', schema: z.object({}), perform: async () => {
            await currentServices().resolve(token);
            await shouldRejectWithError(registry.dispose(), /Cannot await/);
            return 'done';
        } })] });
        const result = await beforeDeadline(server.performQuery('Self', {}, context('self')), 'self-await prevention');
        result.isSuccess.should.equal(true);
        await beforeDeadline(registry.dispose(), 'external dispose');
    });
    it('fails fast when a scope factory or disposer awaits its own closure', async () => {
        const token = serviceToken<object>('self');
        const registry = new ServiceRegistry([{ token, lifetime: 'scoped', factory: async scope => {
            await shouldRejectWithError(scope.dispose(), /Cannot await/);
            return { [Symbol.asyncDispose]: async () => { await shouldRejectWithError(scope.dispose(), /Cannot await/); } };
        } }]);
        const scope = registry.createScope(context('alpha'));
        await beforeDeadline(scope.resolve(token), 'scope self-await');
        await beforeDeadline(scope.dispose(), 'scope disposal');
        await registry.dispose();
    });
    it('lets a singleton disposer join an already-closing manual scope', async () => {
        const root = serviceToken<object>('root'); const resource = serviceToken<object>('manual resource');
        const entered = gate(); const release = gate(); const events: string[] = [];
        let manual!: ServiceScope;
        const registry = new ServiceRegistry([
            { token: resource, lifetime: 'scoped', factory: () => ({ [Symbol.asyncDispose]: async () => {
                entered.release(); await release.promise; events.push('manual');
            } }) },
            { token: root, lifetime: 'singleton', factory: () => ({ [Symbol.asyncDispose]: async () => {
                await manual.dispose(); events.push('root');
            } }) }
        ]);
        try {
            manual = registry.createScope(context('manual'));
            await manual.resolve(resource);
            await manual.resolve(root);
            const closing = manual.dispose();
            await entered.promise;
            const shutdown = registry.dispose();
            release.release();
            await beforeDeadline(Promise.all([closing, shutdown]), 'singleton joining manual scope');
            events.should.deep.equal(['manual', 'root']);
        } finally { release.release(); await registry.dispose(); }
    });
    it('allows a scoped disposer to close an unrelated manual scope and run a nested command', async () => {
        const token = serviceToken<object>('outer resource'); const resource = serviceToken<object>('other resource');
        let effects = 0; const events: string[] = [];
        const registry = new ServiceRegistry([
            { token: resource, lifetime: 'scoped', factory: () => ({ [Symbol.dispose]: () => { events.push('other'); } }) },
            { token, lifetime: 'scoped', factory: () => ({ [Symbol.asyncDispose]: async () => {
                const manual = registry.createScope(context('other'));
                await manual.resolve(resource);
                await manual.dispose();
                const result = await server.executeCommand('Audit', {}, context('audit'));
                result.isSuccess.should.equal(true);
                events.push('outer');
            } }) }
        ]);
        const server = new ArcServer({ services: registry, commands: [
            defineCommand({ name: 'Audit', schema: z.object({}), handle: () => { effects++; return 'audited'; } }),
            defineCommand({ name: 'Work', schema: z.object({}), handle: async () => {
                await currentServices().resolve(token);
                return 'committed';
            } })
        ] });
        try {
            const result = await beforeDeadline(server.executeCommand('Work', {}, context('work')), 'nested audit in disposer');
            result.isSuccess.should.equal(true);
            should().equal(result.response, 'committed');
            effects.should.equal(1);
            events.should.deep.equal(['other', 'outer']);
        } finally { await registry.dispose(); }
    });
    it('rejects disposal cycles through active ancestors but not settled detached disposer ancestry', async () => {
        const first = serviceToken<object>('first'); const second = serviceToken<object>('second');
        const release = gate(); let detached!: Promise<void>; let a!: ServiceScope; let b!: ServiceScope;
        const registry = new ServiceRegistry([
            { token: first, lifetime: 'scoped', factory: () => ({ [Symbol.asyncDispose]: async () => {
                await b.dispose();
                detached = (async () => { await release.promise; await a.dispose(); })();
            } }) },
            { token: second, lifetime: 'scoped', factory: () => ({ [Symbol.asyncDispose]: async () => {
                await shouldRejectWithError(a.dispose(), /Cannot await/);
            } }) }
        ]);
        try {
            a = registry.createScope(context('a')); b = registry.createScope(context('b'));
            await a.resolve(first); await b.resolve(second);
            await beforeDeadline(a.dispose(), 'active disposal ancestry');
            release.release();
            await beforeDeadline(detached, 'settled detached disposal ancestry');
        } finally { release.release(); await registry.dispose(); }
    });
    it('keeps root captive mistakes outside factory construction and leaves healthy singletons usable', async () => {
        const scoped = serviceToken<object>('scoped'); const transient = serviceToken<object>('transient'); const root = serviceToken<object>('root');
        const release = gate(); let detached!: Promise<void>; let creations = 0;
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: 'scoped', factory: () => ({}) },
            { token: transient, lifetime: 'transient', factory: () => ({}) },
            { token: root, lifetime: 'singleton', factory: resolver => {
                creations++;
                detached = (async () => {
                    await release.promise;
                    await shouldRejectWithError(Promise.resolve().then(() => currentServices().resolve(scoped)), /Captive service dependency/);
                    await shouldRejectWithError(Promise.resolve().then(() => resolver.resolve(transient)), /Captive service dependency/);
                })();
                return {};
            } }
        ]);
        try {
            const singletons = registry.singletonScope();
            await shouldRejectWithError(Promise.resolve().then(() => singletons.resolve(scoped)), /Captive service dependency/);
            await shouldRejectWithError(Promise.resolve().then(() => singletons.resolve(transient)), /Captive service dependency/);
            registry.singletonFailed.should.equal(false);
            await singletons.resolve(root);
            release.release();
            await beforeDeadline(detached, 'detached root captive check');
            registry.singletonFailed.should.equal(false);
            creations.should.equal(1);
            const manual = registry.createScope(context('manual'));
            await manual.resolve(scoped);
            await manual.dispose();
        } finally { release.release(); await registry.dispose(); }
    });
    it('keeps scope identity fields getter-only in declarations and at runtime', async () => {
        const registry = new ServiceRegistry();
        const identity = context('original');
        const scope = registry.createScope(identity);
        const readOnlyAssignments = (target: ServiceScope): void => {
            // @ts-expect-error singleton has no public setter
            target.singleton = true;
            // @ts-expect-error registry has no public setter
            target.registry = registry;
            // @ts-expect-error identity has no public setter
            target.identity = identity;
        };
        void readOnlyAssignments;
        try {
            for (const [name, replacement] of Object.entries({ singleton: true, registry: {}, identity: context('forged') })) {
                const original = Reflect.get(scope, name);
                should().equal(Object.getOwnPropertyDescriptor(ServiceScope.prototype, name)?.set, undefined);
                Object.hasOwn(scope, name).should.equal(false);
                Reflect.set(scope, name, replacement).should.equal(false);
                (() => Object.assign(scope, { [name]: replacement })).should.throw(TypeError);
                should().equal(Reflect.get(scope, name), original);
            }
            scope.singleton.should.equal(false);
            should().equal(scope.registry, registry);
            should().equal(scope.identity, identity);
        } finally { await registry.dispose(); }
    });
    it('keeps private dispatch and ownership stable even if public scope getters are shadowed', async () => {
        const scoped = serviceToken<object>('scoped'); const root = serviceToken<object>('root'); const alias = serviceToken<object>('alias');
        const events: string[] = []; let scopedCreations = 0; let rootCreations = 0; let firstScoped!: object;
        const registry = new ServiceRegistry([
            { token: scoped, lifetime: 'scoped', factory: () => {
                scopedCreations++;
                return { [Symbol.dispose]: () => { events.push('scoped'); } };
            } },
            { token: root, lifetime: 'singleton', factory: () => {
                rootCreations++;
                return { [Symbol.dispose]: () => { events.push('root'); } };
            } },
            { token: alias, lifetime: 'scoped', factory: () => firstScoped }
        ]);
        const scope = registry.createScope(context('original'));
        try {
            firstScoped = await scope.resolve(scoped);
            const firstRoot = await scope.resolve(root);
            const singletons = registry.singletonScope();
            Object.defineProperties(scope, {
                singleton: { value: true, configurable: true },
                registry: { value: {}, configurable: true },
                identity: { value: undefined, configurable: true }
            });
            Object.defineProperties(singletons, {
                singleton: { value: false, configurable: true },
                registry: { value: {}, configurable: true },
                identity: { value: context('forged'), configurable: true }
            });
            should().equal(await scope.resolve(scoped), firstScoped);
            should().equal(await scope.resolve(root), firstRoot);
            should().equal(await singletons.resolve(root), firstRoot);
            await shouldRejectWithError(Promise.resolve().then(() => singletons.resolve(scoped)), /Captive service dependency/);
            const other = registry.createScope(context('other'));
            await shouldRejectWithError(other.resolve(alias), /Conflicting service ownership/);
            scopedCreations.should.equal(1);
            rootCreations.should.equal(1);
            await scope.dispose();
            events.should.deep.equal(['scoped']);
            await registry.dispose();
            events.should.deep.equal(['scoped', 'root']);
        } finally { await registry.dispose(); }
    });
    it('hides shutdown bypasses and rejects forged root scopes in runtime and declarations', async () => {
        expectTypeOf<ServiceScope>().not.toHaveProperty('disposeInternal');
        expectTypeOf<ServiceScope>().not.toHaveProperty('disposeCreated');
        expectTypeOf<ServiceRegistry>().not.toHaveProperty('withDisposal');
        expectTypeOf<ServiceRegistry>().not.toHaveProperty('disposing');
        expectTypeOf<ConstructorParameters<typeof ServiceScope>>().toEqualTypeOf<[ServiceRegistry, ExecutionContext | undefined]>();
        expectTypeOf<typeof publicApi>().not.toHaveProperty('closeServiceScope');
        expectTypeOf<typeof publicApi>().not.toHaveProperty('disposeCreatedServices');
        expectTypeOf<typeof publicApi>().not.toHaveProperty('createSingletonServiceScope');
        const singleton = serviceToken<object>('single root'); let creations = 0;
        const registry = new ServiceRegistry([{ token: singleton, lifetime: 'singleton', factory: () => { creations++; return {}; } }]);
        try {
            for (const method of ['disposeInternal', 'disposeCreated']) {
                Object.hasOwn(ServiceScope.prototype, method).should.equal(false);
                should().equal((registry.singletonScope() as unknown as Record<string, unknown>)[method], undefined);
            }
            for (const method of ['withDisposal', 'disposing']) {
                Object.hasOwn(ServiceRegistry.prototype, method).should.equal(false);
                should().equal((registry as unknown as Record<string, unknown>)[method], undefined);
            }
            for (const helper of ['closeServiceScope', 'disposeCreatedServices', 'createSingletonServiceScope'])
                Object.hasOwn(publicApi, helper).should.equal(false);
            (() => Reflect.construct(ServiceScope, [registry, context('invalid'), true])).should.throw(/Invalid service scope construction/);
            (() => Reflect.construct(ServiceScope, [registry, context('invalid'), Symbol('singleton scope')])).should.throw(/Invalid service scope construction/);
            const manual = new ServiceScope(registry, context('direct'));
            await manual.resolve(singleton);
            await registry.singletonScope().resolve(singleton);
            creations.should.equal(1);
            await manual.dispose();
        } finally { await registry.dispose(); }
        (() => Reflect.construct(ServiceScope, [registry, undefined, true])).should.throw(/Invalid service scope construction/);
        (() => new ServiceScope(registry, context('after close'))).should.throw(/disposed/);
    });
    it('poisons and joins shutdown on factory failure even when all callers abandon it', async () => {
        const partial = serviceToken<object>('partial'); const broken = serviceToken<object>('broken');
        const entered = gate(); const release = gate(); const events: string[] = [];
        const registry = new ServiceRegistry([
            { token: partial, lifetime: 'singleton', factory: () => ({ [Symbol.dispose]: () => { events.push('disposed'); throw new Error('cleanup failed'); } }) },
            { token: broken, lifetime: 'singleton', factory: async () => { entered.release(); await release.promise; throw new Error('failed'); } }
        ]);
        const scope = registry.createScope(context('alpha'));
        try {
            await scope.resolve(partial);
            void scope.resolve(broken).catch(() => {});
            await entered.promise;
            release.release();
            await shouldRejectWithError(beforeDeadline(registry.dispose(), 'abandoned failure'), /Service registry disposal failed/);
            registry.singletonFailed.should.equal(true);
            events.should.deep.equal(['disposed']);
            await shouldRejectWithError(registry.dispose(), /Service registry disposal failed/);
        } finally { release.release(); await shouldRejectWithError(registry.dispose(), /Service registry disposal failed/); }
    });
});
