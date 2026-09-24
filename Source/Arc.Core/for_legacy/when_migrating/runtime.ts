// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { shouldRejectWithError } from '../shouldRejectWithError.js';
import { z } from 'zod';
import { ArcServer, AuthenticationStatus, Severity, currentContext, defineCommand, defineQuery, rejected, validation } from '../../index.js';

should();

const post = (url: string, value: unknown, headers: Record<string, string> = {}) => new Request('http://localhost' + url, { method: 'POST', headers, body: JSON.stringify(value) });
describe('command pipeline and wire contract', () => {
    it('does not provide, handle or begin scopes on validation-only and blocked authorization', async () => {
        const calls: string[] = [];
        const server = new ArcServer({ commands: [defineCommand({
            name: 'Create', namespace: 'Tasks', schema: z.object({ title: z.string() }), authorization: { roles: ['writer'] },
            validate: () => { calls.push('validate'); return [validation('bad', ['title'], 'rule', Severity.Error)]; },
            provide: () => { calls.push('provide'); return 1; }, handle: () => { calls.push('handle'); return 1; },
            scopes: [() => ({ begin: () => { calls.push('begin'); }, complete: () => { calls.push('complete'); } })]
        })], authentication: [() => ({ status: AuthenticationStatus.Authenticated, principal: { id: 'a', roles: ['reader'], isAuthenticated: true } })] });
        const denied = await server.handle(post('/api/tasks/create', { title: 1 }));
        should().equal(denied?.status, 403);
        (calls).should.deep.equal([]);
        const permitted = new ArcServer({ commands: [defineCommand({ name: 'Create', namespace: 'Tasks', schema: z.object({ title: z.string() }), validate: () => { calls.push('validate'); return []; }, provide: () => { calls.push('provide'); return 1; }, handle: () => { calls.push('handle'); return 1; }, scopes: [() => ({ begin: () => { calls.push('begin'); }, complete: () => { calls.push('complete'); } })] })] });
        const result = await permitted.handle(post('/api/tasks/create/validate', { title: 'hello' }));
        should().equal(result?.status, 200);
        (calls).should.deep.equal(['validate']);
    });
    it('clears a response after completion fails and logs original while redacting', async () => {
        const logged: unknown[] = [];
        const order: string[] = [];
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => 'secret response', scopes: [
            () => ({ begin: () => { order.push('first'); }, complete: () => { order.push('last'); } }),
            () => ({ begin: () => { order.push('second'); }, complete: () => { order.push('reverse'); throw new Error('sensitive error'); } })
        ] })], logger: error => { logged.push(error); } });
        const result = await server.handle(post('/api/save', {}));
        const value = await result!.json();
        should().equal(result?.status, 500);
        (value.isSuccess).should.equal(false);
        should().equal(value.response, undefined);
        (value.exceptionMessages).should.deep.equal(['An unexpected error occurred']);
        should().exist(logged[0]);
        (logged[0] as object).should.be.instanceOf(Error);
        ((logged[0] as Error).message).should.equal('sensitive error');
        (order).should.deep.equal(['first', 'second', 'reverse', 'last']);
    });
    it('short circuits provide, filters severity and protects concurrent contexts', async () => {
        const command = defineCommand({ name: 'Save', schema: z.object({ value: z.string() }), validate: () => [validation('warning', ['value'], 'rule', Severity.Warning)], provide: () => rejected(validation('no', ['value'])), handle: () => 'never' });
        const server = new ArcServer({ commands: [command] });
        ((await (await server.handle(post('/api/save', { value: 'a' })))!.json()).validationResults[0].message).should.equal('no');
        const result = await (await server.handle(post('/api/save', { value: 'a' }, { 'X-Allowed-Severity': '1' })))!.json();
        (result.validationResults[0].message).should.equal('warning');
        const concurrent = new ArcServer({ queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: async (_input, context) => { await new Promise(resolve => setTimeout(resolve, context.tenantId === 'a' ? 10 : 0)); return [context.tenantId, currentContext()?.tenantId]; } })] });
        const [a, b] = await Promise.all(['a', 'b'].map(tenant => concurrent.handle(new Request('http://localhost/api/tenant', { headers: { 'x-cratis-tenant-id': tenant } }))));
        ((await a!.json()).data).should.deep.equal(['a', 'a']);
        ((await b!.json()).data).should.deep.equal(['b', 'b']);
    });
    it('bounds bodies without relying on content-length', async () => {
        const server = new ArcServer({ maxBodyBytes: 10, commands: [defineCommand({ name: 'Create', schema: z.object({ value: z.string() }), handle: () => 1 })] });
        const oversized = await server.handle(post('/api/create', { value: 'too long' }));
        should().equal(oversized?.status, 400);
        ((await oversized!.json()).validationResults[0].reason).should.equal('malformedRequest');
    });
    it('fails closed on authentication rejection and never lets later handlers override it', async () => {
        const calls: string[] = [];
        const server = new ArcServer({ commands: [defineCommand({ name: 'Create', schema: z.object({}), authorization: { authenticated: true }, handle: () => { calls.push('handle'); return 'secret'; } })], authentication: [
            () => { calls.push('first'); return { status: AuthenticationStatus.Anonymous }; },
            () => { calls.push('failed'); return { status: AuthenticationStatus.Failed }; },
            () => { calls.push('later'); return { status: AuthenticationStatus.Authenticated, principal: { id: 'id', roles: [], isAuthenticated: true } }; }
        ] });
        const result = await server.handle(post('/api/create', {}));
        should().equal(result?.status, 401);
        (calls).should.deep.equal(['first', 'failed']);
        should().equal((await result!.json()).response, undefined);
    });
    it('resolves fully qualified names without short-name ambiguity', async () => {
        const commands = ['Alpha', 'Beta'].map(namespace => defineCommand({ name: 'Create', namespace, schema: z.object({}), handle: () => namespace }));
        const queries = ['Alpha', 'Beta'].map(namespace => defineQuery({ name: 'List', namespace, schema: z.object({}), perform: () => namespace }));
        const server = new ArcServer({ commands, queries });
        const context = { correlationId: crypto.randomUUID(), principal: undefined, tenantId: undefined, allowedSeverity: Severity.Warning, signal: new AbortController().signal };
        should().equal((await server.executeCommand('Beta.Create', {}, context)).response, 'Beta');
        should().equal((await server.performQuery('Alpha.List', {}, context)).data, 'Alpha');
        await shouldRejectWithError(server.executeCommand('Create', {}, context), /Unknown command/);
        await shouldRejectWithError(server.performQuery('List', {}, context), /Unknown query/);
    });
    it('rejects malformed bodies and duplicate registrations, not unrelated routes', async () => {
        const command = defineCommand({ name: 'Save', schema: z.object({ value: z.number() }), handle: value => value.value });
        const server = new ArcServer({ commands: [command] });
        should().equal(await server.handle(new Request('http://localhost/elsewhere')), null);
        (() => new ArcServer({ commands: [command, command] })).should.throw();
        const response = await server.handle(new Request('http://localhost/api/save', { method: 'POST', body: '{invalid' }));
        should().equal(response?.status, 400);
        ((await response!.json()).validationResults[0].reason).should.equal('malformedRequest');
        for (const text of ['{"value":1e309}', '{"value":1,"__proto__":{"polluted":true}}', '{"value":1,"constructor":{}}']) {
            const bad = await server.handle(new Request('http://localhost/api/save', { method: 'POST', body: text }));
            should().equal(bad?.status, 400);
            ((await bad!.json()).validationResults[0].reason).should.equal('malformedRequest');
        }
        const large = await server.handle(new Request('http://localhost/api/save', { method: 'POST', body: '{"value":12345}' }));
        should().equal(large?.status, 200);
        ((await (await server.handle(post('/api/save', { value: 5, unexpected: 'discarded' })))!.json()).response).should.equal(5);
    });
});
