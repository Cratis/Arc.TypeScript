// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer, Severity, currentContext, defineCommand, defineQuery, denied, queryPage, rejected, validation } from '../src/index.js';

should();

const post = (path: string, headers: Record<string, string> = {}) => new Request('http://arc.invalid' + path, { method: 'POST', body: '{}', headers });
const context = (tenantId: string) => ({ correlationId: crypto.randomUUID(), tenantId, principal: undefined, allowedSeverity: Severity.Warning, signal: new AbortController().signal });
describe('pre-release core regressions', () => {
    it('rejects unsafe body limits and operation names even for custom paths; splits acronyms', () => {
        for (const maxBodyBytes of [0, -1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1])
            (() => new ArcServer({ maxBodyBytes })).should.throw();
        for (const name of ['Bad/Name', '', 'Bad-Name'])
            (() => new ArcServer({ commands: [defineCommand({ name, path: '/custom', schema: z.object({}), handle: () => 1 })] })).should.throw();
        (() => new ArcServer({ queries: [defineQuery({ name: 'List', namespace: 'Bad..Name', path: '/custom', schema: z.object({}), perform: () => 1 })] })).should.throw();
        should().equal(new ArcServer({ queries: [defineQuery({ name: 'HTTPReader', namespace: 'API.Users', schema: z.object({}), perform: () => 1 })] }).queries[0]?.route, '/api/api/users/http-reader');
    });
    it('rejects contradictory anonymous and protected metadata at registration, but accepts public resource checks', () => {
        const command = (authorization: { anonymous: boolean; authenticated?: boolean; roles?: string[] }) =>
            defineCommand({ name: 'Save', schema: z.object({}), authorization, handle: () => 1 });
        const query = (authorization: { anonymous: boolean; authenticated?: boolean; roles?: string[] }) =>
            defineQuery({ name: 'List', schema: z.object({}), authorization, perform: () => 1 });
        for (const authorization of [{ anonymous: true, roles: ['Admin'] }, { anonymous: true, authenticated: true }]) {
            (() => new ArcServer({ commands: [command(authorization)] })).should.throw('Conflicting Arc authorization');
            (() => new ArcServer({ queries: [query(authorization)] })).should.throw('Conflicting Arc authorization');
        }
        (() => new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), authorization: { anonymous: true }, authorize: () => true, handle: () => 1 })] })).should.not.throw();
    });
    it('honors tenant resolver without fallback and isolates direct nested ALS contexts', async () => {
        const server = new ArcServer({ resolveTenant: () => undefined, queries: [defineQuery({ name: 'Tenant', schema: z.object({}), perform: (_input, ctx) => [ctx.tenantId, currentContext()?.tenantId] })] });
        const result = await server.handle(new Request('http://arc.invalid/api/tenant', { headers: { 'x-cratis-tenant-id': 'forged' } }));
        ((await result!.json()).data).should.deep.equal([null, null]);
        const nested = new ArcServer({ commands: [defineCommand({ name: 'Outer', schema: z.object({}), handle: async () => {
            const before = currentContext();
            await server.performQuery('Tenant', {}, context('inner'));
            return [before?.tenantId, currentContext()?.tenantId, Object.isFrozen(before)];
        } })] });
        const nestedResponse = (await nested.executeCommand('Outer', {}, context('outer'))).response;
        should().exist(nestedResponse);
        (nestedResponse as object).should.deep.equal(['outer', 'outer', true]);
        should().equal(currentContext(), undefined);
    });
    it('executes real validate-suffixed operations and brands control outcomes', async () => {
        const server = new ArcServer({ commands: [defineCommand<z.ZodType, { kind: string; value: number }>({ name: 'Validate', schema: z.object({}), handle: () => ({ kind: 'denied', value: 1 }) }),
            defineCommand<z.ZodType, { kind: string; value: number }>({ name: 'Check', path: '/x/validate', schema: z.object({}), handle: () => ({ kind: 'validation', value: 2 }) })] });
        ((await (await server.handle(post('/api/validate')))!.json()).response).should.deep.equal({ kind: 'denied', value: 1 });
        ((await (await server.handle(post('/x/validate')))!.json()).response).should.deep.equal({ kind: 'validation', value: 2 });
        (() => rejected()).should.throw();
        let called = false;
        const empty = new ArcServer({ commands: [defineCommand({ name: 'Empty', schema: z.object({}), provide: () => rejected(), handle: () => { called = true; return 1; } })] });
        ((await empty.handle(post('/api/empty')))!.status).should.equal(500);
        (called).should.equal(false);
    });
    it('completes a partly begun scope once and strips response if completion fails', async () => {
        const calls: string[] = [];
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), handle: () => { calls.push('handle'); return 'secret'; }, scopes: [
            () => ({ begin: () => { calls.push('first'); }, complete: () => { calls.push('complete first'); } }),
            () => ({ begin: () => { calls.push('second'); throw Error('begin'); }, complete: () => { calls.push('complete second'); throw Error('complete'); } })
        ] })] });
        const result = await (await server.handle(post('/api/save')))!.json();
        should().equal(result.response, undefined);
        (result.hasExceptions).should.equal(true);
        (calls).should.deep.equal(['first', 'second', 'complete second', 'complete first']);
    });
    it('filters provided warnings, keeps security authorization independent from severity', async () => {
        let handled = 0;
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), authorize: () => false,
            provide: () => rejected(validation('warning', [], 'warning', Severity.Warning)), handle: () => { handled++; return 1; } })] });
        ((await (await server.handle(post('/api/save', { 'X-Allowed-Severity': '3' })))!.json()).isAuthorized).should.equal(false);
        (handled).should.equal(0);
        const permitted = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}),
            provide: () => rejected(validation('warning', [], 'warning', Severity.Warning)), handle: (_input, _context, provided) => {
                should().equal(provided, undefined);
                return ++handled;
            } })] });
        ((await (await permitted.handle(post('/api/save')))!.json()).response).should.equal(1);
        const blocked = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), provide: () => denied(), handle: () => ++handled })] });
        ((await blocked.handle(post('/api/save', { 'X-Allowed-Severity': '3' })))!.status).should.equal(403);
    });
    it('reports validator failures without exposing secrets and logs original errors; does not treat query severity header as command setting', async () => {
        const logged: unknown[] = [];
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), validate: () => { throw Error('secret'); }, handle: () => 1 })],
            queries: [defineQuery({ name: 'List', schema: z.object({}), validate: () => [validation('bad', [], 'rule', Severity.Error)], perform: () => 1 })], logger: error => logged.push(error) });
        const response = await server.handle(post('/api/save'));
        should().equal(response?.status, 400);
        const result = await response!.json();
        (result.validationResults[0].reason).should.equal('validatorFailed');
        (JSON.stringify(result)).should.not.contain('secret');
        ((logged[0] as Error).message).should.equal('secret');
        ((await server.handle(new Request('http://arc.invalid/api/list', { headers: { 'X-Allowed-Severity': '3' } })))!.status).should.equal(400);
    });
    it('caps HTTP-selected severity at Warning without changing trusted direct context or lower wire values', async () => {
        let handled = 0;
        const server = new ArcServer({ commands: [
            defineCommand({ name: 'Business', schema: z.object({}), validate: () => [validation('blocked', [], 'rule', Severity.Error)], handle: () => ++handled }),
            defineCommand({ name: 'Warning', schema: z.object({}), validate: () => [validation('warning', [], 'rule', Severity.Warning)], handle: (_input, ctx) => { handled++; return ctx.allowedSeverity; } }),
            defineCommand({ name: 'Protected', schema: z.object({}), authorize: () => false, handle: () => ++handled })
        ], queries: [defineQuery({ name: 'Read', schema: z.object({}), validate: () => [validation('blocked', [], 'rule', Severity.Error)], perform: () => ++handled })] });
        const deniedError = await server.handle(post('/api/business', { 'X-Allowed-Severity': '3' }));
        should().equal(deniedError?.status, 400);
        ((await deniedError!.json()).validationResults[0].message).should.equal('blocked');
        (handled).should.equal(0);
        ((await server.handle(post('/api/protected', { 'X-Allowed-Severity': '3' })))!.status).should.equal(403);
        ((await server.handle(new Request('http://arc.invalid/api/read', { headers: { 'X-Allowed-Severity': '3' } })))!.status).should.equal(400);
        (handled).should.equal(0);
        for (const header of ['0', '1']) ((await server.handle(post('/api/warning', { 'X-Allowed-Severity': header })))!.status).should.equal(400);
        const accepted = await server.handle(post('/api/warning', { 'X-Allowed-Severity': '2' }));
        should().equal(accepted?.status, 200);
        ((await accepted!.json()).response).should.equal(Severity.Warning);
        const invalid = await server.handle(post('/api/warning', { 'X-Allowed-Severity': 'unknown' }));
        should().equal(invalid?.status, 200);
        ((await invalid!.json()).response).should.equal(Severity.Warning);
        (handled).should.equal(2);
        const direct = await server.executeCommand('Business', {}, { ...context('trusted'), allowedSeverity: Severity.Error });
        (direct.isSuccess).should.equal(true);
        should().equal(direct.response, 3);
    });
    it('does not misreport a cancelled validator as a validation rule', async () => {
        const controller = new AbortController();
        controller.abort();
        const server = new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), validate: () => { throw Error('cancelled'); }, handle: () => 1 })] });
        const result = await server.executeCommand('Save', {}, { ...context('tenant'), signal: controller.signal });
        (result.validationResults).should.deep.equal([]);
        (result.hasExceptions).should.equal(true);
    });
    it('accepts already-paged results without slicing and rejects inconsistent metadata', async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'List', schema: z.object({}), perform: () => queryPage([3, 4], 5) })] });
        const result = await (await server.handle(new Request('http://arc.invalid/api/list?page=1&pageSize=2')))!.json();
        (result.data).should.deep.equal([3, 4]);
        (result.paging).should.deep.equal({ page: 1, size: 2, totalItems: 5, totalPages: 3 });
        (() => queryPage([1, 2], 1)).should.throw();
        ((await server.handle(new Request('http://arc.invalid/api/list')))!.status).should.equal(400);
        ((await server.handle(new Request('http://arc.invalid/api/list?page=2&pageSize=2')))!.status).should.equal(400);
    });
    it('coerces repeated GET array values through nested wrappers, rejects folded ambiguity and supports unpaged QUERY', async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'List', schema: z.object({ ids: z.array(z.number()).nullable().default([]), active: z.boolean().optional().nullable() }), perform: input => [input] })] });
        ((await (await server.handle(new Request('http://arc.invalid/api/list?ids=2&ids=3&active=false')))!.json()).data).should.deep.equal([{ ids: [2, 3], active: false }]);
        ((await server.handle(new Request('http://arc.invalid/api/list?ids=2&IDS=3')))!.status).should.equal(400);
        ((await server.handle(new Request('http://arc.invalid/api/list?active=true&active=false')))!.status).should.equal(400);
        const unpaged = await server.handle(new Request('http://arc.invalid/api/list', { method: 'QUERY', body: JSON.stringify({ paging: { page: 0, pageSize: 0 } }) }));
        should().equal(unpaged?.status, 200);
    });
    it('sorts dates by epoch, booleans and nulls consistently', async () => {
        const server = new ArcServer({ queries: [defineQuery({ name: 'List', schema: z.object({}), perform: () => [
            { when: new Date('2021-01-01'), enabled: true }, { when: new Date('2020-01-01'), enabled: false }
        ] })] });
        ((await (await server.handle(new Request('http://arc.invalid/api/list?sortBy=when')))!.json()).data[0].when).should.equal('2020-01-01T00:00:00.000Z');
        ((await (await server.handle(new Request('http://arc.invalid/api/list?sortBy=enabled')))!.json()).data[0].enabled).should.equal(false);
        const direct = new ArcServer({ queries: [defineQuery({ name: 'Numbers', schema: z.object({}), perform: () => [{ key: 10n }, { key: null }, { key: 2n }] })] });
        const sorted = await direct.performQuery('Numbers', {}, context('tenant'), { sorting: { field: 'key', direction: 'asc' } });
        should().exist(sorted.data);
        (sorted.data as object).should.deep.equal([{ key: null }, { key: 2n }, { key: 10n }]);
    });
});
