// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { request as httpRequest } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import WebSocket from 'ws';
import { normalize, request, startServer } from './harness.mjs';

const root = resolve(fileURLToPath(new URL('../../', import.meta.url)));
const correlationId = '11111111-1111-4111-8111-111111111111';
const correlationHeader = 'x-correlation-id';
const items = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }, { id: 3, name: 'Linus' }];
const paging = (page = 0, size = 0, totalItems = 0, totalPages = 0) => ({ page, size, totalItems, totalPages });
const command = (status, extra = {}, id = correlationId) => ({
    correlationId: id, isSuccess: status === 200, isAuthorized: status !== 403 && status !== 401,
    isValid: status !== 400, hasExceptions: status === 500, validationResults: [], exceptionMessages: [],
    exceptionStackTrace: '', authorizationFailureReason: '', ...extra
});
const query = (status, extra = {}, id = correlationId) => ({
    paging: paging(), correlationId: id, isSuccess: status === 200, isReady: true,
    isAuthorized: status !== 403 && status !== 401, isValid: status !== 400, hasExceptions: status === 500,
    validationResults: [], exceptionMessages: [], exceptionStackTrace: '', ...extra
});
const rule = { severity: 3, message: 'Value is required', members: ['value'], reason: 'rule' };
const malformedDotNet = { severity: 3, message: 'The request body could not be read or is not valid for this command.', members: [], reason: 'malformedRequest' };
const malformedTypeScript = { severity: 3, message: 'Malformed request', members: [], reason: 'malformedRequest' };
const netReaderFailure = query(400, { isValid: true, hasExceptions: true, exceptionMessages: [
    'An internal error occurred while processing the request. See server logs for details.'
] });
const tsReaderFailure = query(400, { isValid: true, hasExceptions: true, exceptionMessages: ['An unexpected error occurred'] });
const pagingRule = (message, member) => query(400, { validationResults: [{ severity: 3, message, members: [member], reason: 'rule' }] });
const badDirection = member => query(400, { validationResults: [{ severity: 3,
    message: 'The sort direction is not a recognized value.', members: [member], reason: 'malformedRequest' }] });
const directSocket = async (baseUrl, value, closeOnOpen = false, id = correlationId) => {
    const socket = new WebSocket(`${baseUrl.replace('http:', 'ws:')}/api/filter-parity-stream?value=${value}`, {
        headers: { 'X-Correlation-ID': id }
    });
    let timer;
    try {
        return await Promise.race([new Promise((resolveFrame, reject) => {
            socket.once('error', reject);
            socket.once('open', () => { if (closeOnOpen) { socket.close(); resolveFrame(undefined); } });
            socket.once('message', data => resolveFrame(JSON.parse(data.toString())));
            socket.once('close', () => { if (!closeOnOpen) reject(new Error('WebSocket closed before admission result')); });
        }), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Direct WebSocket admission timed out')), 10_000); })]);
    } finally { clearTimeout(timer); socket.terminate(); }
};
const firstSseData = async response => {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
        const { value, done } = await reader.read();
        if (done) throw new Error('Direct SSE closed before its first data event');
        buffer += decoder.decode(value, { stream: true });
        if (buffer.length > 65_536) throw new Error('Direct SSE event exceeds fixture limit');
        let end;
        while ((end = buffer.indexOf('\n\n')) !== -1) {
            const event = buffer.slice(0, end);
            buffer = buffer.slice(end + 2);
            const lines = event.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart());
            if (lines.length) return JSON.parse(lines.join('\n'));
        }
    }
};
const directSse = async (baseUrl, label, id) => {
    const controller = new AbortController();
    try {
        const response = await fetch(`${baseUrl}/api/filter-parity-stream?value=allow-valid`, {
            headers: { Accept: 'text/event-stream', 'X-Correlation-ID': id },
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)])
        });
        assert.equal(response.status, 200, label);
        assert.match(response.headers.get('content-type'), /^text\/event-stream/, label);
        return await firstSseData(response);
    } finally { controller.abort(); }
};
// fetch overrides Host with the dialed loopback address. Exercise the explicit authority with a raw HTTP request.
const requestWithHost = (baseUrl, path, headers) => new Promise((resolveResponse, reject) => {
    const connection = httpRequest(new URL(path, baseUrl), { headers }, response => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', chunk => { text += chunk; });
        response.on('end', () => resolveResponse({ status: response.statusCode,
            headers: response.headers, body: JSON.parse(text) }));
    });
    connection.on('error', reject);
    connection.end();
});

// Every pair first checks each server against independent, explicit expectations.
// The final equality check then detects any unanticipated protocol difference.
test('published .NET and built TypeScript HTTP contract', async t => {
    const dotnet = await startServer('dotnet', ['ContractTests/DotNET/bin/Debug/net10.0/Arc.TypeScript.HttpFixture.dll'], {
        cwd: root, kind: 'typescript-dotnet-reference-ready'
    });
    let typescript;
    try {
        assert.equal(dotnet.readiness.package, 'Cratis.Arc 22.23.0', 'published .NET reference package');
        assert.equal(dotnet.readiness.runtime, '10.0.11', 'pinned .NET runtime');
        typescript = await startServer(process.execPath, ['ContractTests/Http/fixture.mjs'], {
            cwd: root, kind: 'typescript-http-fixture-ready'
        });
        const send = async (method, path, body, headers = {}, typescriptUrl = typescript.url) => {
            const options = { 'X-Correlation-ID': correlationId, ...headers };
            return Promise.all([request(dotnet.url, method, path, body, options), request(typescriptUrl, method, path, body, options)]);
        };
        const check = (actual, expected, label, headerNames = [correlationHeader, 'content-type']) => {
            assert.equal(actual.status, expected.status, `${label}: status; body=${JSON.stringify(actual.body)}`);
            assert.deepEqual(actual.body, expected.body, `${label}: full envelope`);
            for (const [name, value] of Object.entries(expected.headers ?? { [correlationHeader]: correlationId })) {
                assert.equal(actual.headers[name], value, `${label}: ${name}`);
            }
            return normalize(actual, { headers: headerNames });
        };
        const parity = async (name, method, path, body, expected, headers = {}, extraHeaders = [], typescriptUrl = typescript.url) => t.test(name, async () => {
            const [net, ts] = await send(method, path, body, headers, typescriptUrl);
            const expectedResponse = { status: expected.status, body: expected.body, headers: {
                [correlationHeader]: correlationId, 'content-type': 'application/json; charset=utf-8', ...expected.headers
            } };
            const selected = [correlationHeader, 'content-type', ...extraHeaders];
            const left = check(net, expectedResponse, '.NET', selected);
            const right = check(ts, expectedResponse, 'TypeScript', selected);
            assert.deepEqual(right, left, `${name}: protocol parity`);
        });
        const divergence = async (name, method, path, body, dotnetExpected, typescriptExpected, headers = {}, extraHeaders = [], typescriptUrl = typescript.url) => t.test(name, async context => {
            const [net, ts] = await send(method, path, body, headers, typescriptUrl);
            const selected = [correlationHeader, 'content-type', ...extraHeaders];
            check(net, { status: dotnetExpected.status, body: dotnetExpected.body, headers: { [correlationHeader]: correlationId, 'content-type': 'application/json; charset=utf-8', ...dotnetExpected.headers } }, '.NET', selected);
            check(ts, { status: typescriptExpected.status, body: typescriptExpected.body, headers: { [correlationHeader]: correlationId, 'content-type': 'application/json; charset=utf-8', ...typescriptExpected.headers } }, 'TypeScript', selected);
            assert.notDeepEqual({ status: net.status, body: net.body }, { status: ts.status, body: ts.body }, 'documented divergence remains visible');
            context.diagnostic(`UNSUPPORTED PARITY: ${name}: .NET ${JSON.stringify({ status: net.status, body: net.body })} vs TypeScript ${JSON.stringify({ status: ts.status, body: ts.body })}`);
        });
        const count = (name, value) => parity(name, 'GET', '/api/echo-count', undefined, {
            status: 200, body: query(200, { data: { count: value } })
        });
        const queryCount = (name, value) => parity(name, 'GET', '/api/query-count', undefined, {
            status: 200, body: query(200, { data: { count: value } })
        });
        const queryParity = (name, body, expected) => parity(name, 'QUERY', '/api/items', body,
            { status: expected.status, body: expected.body, headers: { 'cache-control': 'no-store' } }, {}, ['cache-control']);
        const readerDifference = (name, body) => divergence(name, 'QUERY', '/api/items', body,
            { status: 400, body: netReaderFailure, headers: { 'cache-control': 'no-store' } },
            { status: 400, body: tsReaderFailure, headers: { 'cache-control': 'no-store' } }, {}, ['cache-control']);

        const identity = { id: 'fixture-user', name: 'fixture-user', isAuthenticated: true, isAuthorized: true,
            roles: ['Admin'], details: { greeting: 'Hello fixture-user' } };
        await parity('authenticated identity returns verified principal details', 'GET', '/.cratis/me', undefined,
            { status: 200, body: identity }, { 'X-Fixture-Role': 'Admin' });
        await t.test('authenticated identity issues a display-only cookie matching its response', async () => {
            const [net, ts] = await send('GET', '/.cratis/me', undefined, { 'X-Fixture-Role': 'Admin' });
            for (const [label, actual] of [['.NET', net], ['TypeScript', ts]]) {
                assert.equal(actual.status, 200, label);
                assert.deepEqual(actual.body, identity, label);
                assert.match(actual.headers['set-cookie'], /^\.cratis-identity=[^;]+;\s*path=\/;\s*samesite=lax$/i, label);
                const encoded = actual.headers['set-cookie'].split(';')[0].slice('.cratis-identity='.length);
                assert.deepEqual(JSON.parse(Buffer.from(decodeURIComponent(encoded), 'base64').toString()), identity, label);
            }
        });
        for (const [role, status, expected] of [['Reader', 403, { error: 'Forbidden' }], [undefined, 401, { error: 'Unauthorized' }]]) {
            await t.test(`${role ?? 'anonymous'} identity denial: .NET empty, TypeScript JSON`, async context => {
                const headers = role ? { 'X-Fixture-Role': role } : {};
                const [net, ts] = await send('GET', '/.cratis/me', undefined, headers);
                assert.equal(net.status, status);
                assert.equal(net.body, '');
                assert.equal(net.headers['content-type'], undefined);
                assert.equal(net.headers[correlationHeader], correlationId);
                assert.equal(net.headers['set-cookie'], undefined);
                assert.equal(ts.status, status);
                assert.deepEqual(ts.body, expected);
                assert.equal(ts.headers['content-type'], 'application/json; charset=utf-8');
                assert.equal(ts.headers[correlationHeader], correlationId);
                assert.equal(ts.headers['set-cookie'], undefined);
                context.diagnostic('UNSUPPORTED PARITY: identity denial body differs (empty vs JSON error)');
            });
        }
        await t.test('unsigned identity cookie is never a credential in TypeScript', async context => {
            const [authenticated] = await send('GET', '/.cratis/me', undefined, { 'X-Fixture-Role': 'Admin' });
            const cookie = authenticated.headers['set-cookie'].split(';')[0];
            const [net, ts] = await send('GET', '/.cratis/me', undefined, { Cookie: cookie });
            assert.equal(net.status, 200);
            assert.deepEqual(net.body, identity);
            assert.equal(net.headers[correlationHeader], correlationId);
            assert.equal(ts.status, 401);
            assert.deepEqual(ts.body, { error: 'Unauthorized' });
            assert.equal(ts.headers[correlationHeader], correlationId);
            context.diagnostic('UNSUPPORTED PARITY: .NET trusts the display cookie before authentication; TypeScript never does');
        });
        await t.test('identity schema describes the required greeting on both runtimes', async () => {
            const [net, ts] = await send('GET', '/.cratis/identity-details/schema');
            for (const [label, actual] of [['.NET', net], ['TypeScript', ts]]) {
                assert.equal(actual.status, 200, label);
                assert.deepEqual(actual.body.required, ['greeting'], label);
                assert.deepEqual(actual.body.properties.greeting.type, 'string', label);
                assert.equal(actual.headers[correlationHeader], correlationId, label);
            }
        });
        await parity('header selects the tenant for a scoped query', 'GET', '/api/tenant-echo', undefined,
            { status: 200, body: query(200, { data: { tenantId: 'header-tenant' } }) },
            { 'X-Cratis-Tenant-ID': 'header-tenant' });
        await parity('another header selects another tenant', 'GET', '/api/tenant-echo', undefined,
            { status: 200, body: query(200, { data: { tenantId: 'second-tenant' } }) },
            { 'X-Cratis-Tenant-ID': 'second-tenant' });
        for (const [mode, cases] of [
            ['fixed', [
                ['fixed tenant ignores a conflicting header', { 'X-Cratis-Tenant-ID': 'header-tenant' }, 'fixed-tenant']
            ]],
            ['claim', [
                ['verified claim overrides a conflicting header',
                    { 'X-Fixture-Role': 'Admin', 'X-Cratis-Tenant-ID': 'header-tenant' }, 'claim-tenant'],
                ['unverified claim header cannot select the tenant', { 'X-Cratis-Tenant-ID': 'claim-tenant' }, '[NotSet]']
            ]],
            ['subdomain', [
                ['single-label subdomain overrides the header',
                    { Host: 'acme.example.test', 'X-Cratis-Tenant-ID': 'header-tenant' }, 'acme'],
                ['unrelated host falls back to the header',
                    { Host: 'other.test', 'X-Cratis-Tenant-ID': 'fallback-tenant' }, 'fallback-tenant']
            ]]
        ]) {
            await t.test(`${mode} tenant resolution`, async subtest => {
                const env = { ...process.env, ARC_FIXTURE_TENANCY: mode };
                const net = await startServer('dotnet', ['ContractTests/DotNET/bin/Debug/net10.0/Arc.TypeScript.HttpFixture.dll'],
                    { cwd: root, kind: 'typescript-dotnet-reference-ready', env });
                let ts;
                try {
                    ts = await startServer(process.execPath, ['ContractTests/Http/fixture.mjs'],
                        { cwd: root, kind: 'typescript-http-fixture-ready', env });
                    for (const [name, headers, tenantId] of cases) {
                        await subtest.test(name, async () => {
                            const expected = { status: 200, body: query(200, { data: { tenantId } }),
                                headers: { [correlationHeader]: correlationId, 'content-type': 'application/json; charset=utf-8' } };
                            const options = { 'X-Correlation-ID': correlationId, ...headers };
                            const [netResult, tsResult] = await Promise.all([
                                headers.Host ? requestWithHost(net.url, '/api/tenant-echo', options) :
                                    request(net.url, 'GET', '/api/tenant-echo', undefined, options),
                                headers.Host ? requestWithHost(ts.url, '/api/tenant-echo', options) :
                                    request(ts.url, 'GET', '/api/tenant-echo', undefined, options)
                            ]);
                            assert.deepEqual(check(tsResult, expected, 'TypeScript'), check(netResult, expected, '.NET'));
                        });
                    }
                } finally { await Promise.all([ts?.stop(), net.stop()]); }
            });
        }
        for (const adapter of ['express', 'fastify', 'hono']) {
            const host = adapter === 'express' ? typescript : await startServer(process.execPath, ['ContractTests/Http/fixture.mjs'], {
                cwd: root, kind: 'typescript-http-fixture-ready', env: { ...process.env, ARC_FIXTURE_ADAPTER: adapter }
            });
            try {
                assert.equal(host.readiness.adapter, adapter, `${adapter} fixture adapter`);
                const filterParity = (name, method, path, body, expected, headers = {}, extraHeaders = []) =>
                    parity(`${adapter}: ${name}`, method, path, body, expected, headers, extraHeaders, host.url);
                const filterDivergence = (name, method, path, body, netExpected, tsExpected, headers = {}, extraHeaders = []) =>
                    divergence(`${adapter}: ${name}`, method, path, body, netExpected, tsExpected, headers, extraHeaders, host.url);
                for (const [mode, path] of [['execute', '/api/filter-parity-command'],
                    ['validate', '/api/filter-parity-command/validate']]) {
                    const response = mode === 'execute' ? { response: 'allow-valid' } : {};
                    await filterParity(`command filter ${mode} denies before validation`, 'POST', path, { value: 'deny-invalid' }, {
                        status: 403, body: command(403, { authorizationFailureReason: 'Fixture filter denied' })
                    });
                    await filterParity(`command filter ${mode} denies valid input`, 'POST', path, { value: 'deny-valid' }, {
                        status: 403, body: command(403, { authorizationFailureReason: 'Fixture filter denied' })
                    });
                    await filterParity(`command filter ${mode} allows invalid input`, 'POST', path, { value: 'allow-invalid' }, {
                        status: 400, body: command(400, { validationResults: [{ severity: 3, message: 'Value is invalid',
                            members: ['value'], reason: 'rule' }] })
                    });
                    await filterParity(`command filter ${mode} allows valid input`, 'POST', path, { value: 'allow-valid' }, {
                        status: 200, body: command(200, response)
                    });
                    await filterDivergence(`command filter ${mode} denies malformed input in TypeScript`, 'POST', path,
                        { value: ['deny'] }, { status: 400, body: command(400, { validationResults: [malformedDotNet] }) },
                        { status: 403, body: command(403, { authorizationFailureReason: 'Fixture filter denied' }) });
                    await filterDivergence(`command filter ${mode} allows malformed input with different message`, 'POST', path,
                        { value: ['allow'] }, { status: 400, body: command(400, { validationResults: [malformedDotNet] }) },
                        { status: 400, body: command(400, { validationResults: [malformedTypeScript] }) });
                }
                for (const [name, value, expected] of [
                    ['denies invalid arguments before validation', 'deny-invalid', { status: 403, body: query(403, { isAuthorized: false }) }],
                    ['denies valid arguments', 'deny-valid', { status: 403, body: query(403, { isAuthorized: false }) }],
                    ['allows invalid arguments to reach validation', 'allow-invalid', { status: 400, body: query(400, {
                        validationResults: [{ severity: 3, message: 'Value is invalid', members: ['value'], reason: 'rule' }] }) }],
                    ['allows valid arguments', 'allow-valid', { status: 200, body: query(200, { data: { value: 'allow-valid' } }) }]
                ]) {
                    await filterParity(`query filter ${name}`, 'GET', `/api/filter-parity-query?value=${value}`, undefined, expected);
                }
                await filterParity('QUERY filter denies before validation', 'QUERY', '/api/filter-parity-query',
                    { arguments: { value: 'deny-invalid' } }, { status: 403, body: query(403, { isAuthorized: false }),
                        headers: { 'cache-control': 'no-store' } }, {}, ['cache-control']);
                await filterParity('QUERY filter allows a valid query', 'QUERY', '/api/filter-parity-query',
                    { arguments: { value: 'allow-valid' } }, { status: 200, body: query(200, { data: { value: 'allow-valid' } }),
                        headers: { 'cache-control': 'no-store' } }, {}, ['cache-control']);
                await filterParity('observable query filter denies at snapshot admission', 'GET', '/api/filter-parity-stream?value=deny-valid',
                    undefined, { status: 403, body: query(403, { isAuthorized: false }) });
                await filterParity('observable query filter denies direct SSE admission', 'GET',
                    '/api/filter-parity-stream?value=deny-valid', undefined,
                    { status: 403, body: query(403, { isAuthorized: false }) }, { Accept: 'text/event-stream' });
                await filterParity('observable query filter allows snapshot admission', 'GET', '/api/filter-parity-stream?value=allow-valid',
                    undefined, { status: 200, body: query(200, { data: { value: 'allow-valid' } }) });
                const observations = async () => {
                    const result = await request(host.url, 'GET', '/api/filter-parity-observations');
                    assert.equal(result.status, 200);
                    return result.body.data.events;
                };
                const trace = async (name, method, path, body, status, stages) => t.test(`${adapter}: ${name}`, async () => {
                    const marker = randomUUID();
                    const actual = await request(host.url, method, path, body, { 'X-Correlation-ID': marker });
                    assert.equal(actual.status, status);
                    const after = await observations();
                    assert.deepEqual(after.filter(event => event.correlationId === marker).map(event => event.stage), stages);
                });
                await trace('command denial skips ordinary filter, validator construction and handler', 'POST',
                    '/api/filter-parity-command', { value: 'deny-valid' }, 403, ['command authorization']);
                await trace('validate denial skips ordinary filter and validator construction', 'POST',
                    '/api/filter-parity-command/validate', { value: 'deny-invalid' }, 403, ['command authorization']);
                await trace('command authorization precedes ordinary filter and validation', 'POST',
                    '/api/filter-parity-command', { value: 'allow-invalid' }, 400,
                    ['command authorization', 'command ordinary', 'command validator constructed', 'command validator']);
                await trace('command allowed after validation reaches handler', 'POST',
                    '/api/filter-parity-command', { value: 'allow-valid' }, 200,
                    ['command authorization', 'command ordinary', 'command validator constructed', 'command validator', 'command handler']);
                await trace('query denial skips ordinary filter and validator/performer dependencies', 'GET',
                    '/api/filter-parity-query?value=deny-invalid', undefined, 403, ['query authorization']);
                await trace('query authorization precedes ordinary filter, validation and performer', 'GET',
                    '/api/filter-parity-query?value=allow-valid', undefined, 200,
                    ['query authorization', 'query ordinary', 'query validator dependency constructed', 'query validator',
                        'query performer dependency constructed', 'query performer']);
                await trace('query invalid arguments do not construct performer dependencies', 'GET',
                    '/api/filter-parity-query?value=allow-invalid', undefined, 400,
                    ['query authorization', 'query ordinary', 'query validator dependency constructed', 'query validator']);
                await trace('observable denial skips ordinary filter and observer', 'GET',
                    '/api/filter-parity-stream?value=deny-valid', undefined, 403, ['query authorization']);
                await t.test(`${adapter}: direct SSE keeps serving after an early disconnect`, async () => {
                    for (const [label, baseUrl] of [['.NET', dotnet.url], [adapter, host.url]]) {
                        const marker = randomUUID();
                        for (let admission = 0; admission < 2; admission++) {
                            const result = await directSse(baseUrl, label, marker);
                            assert.deepEqual(result.data, { value: 'allow-valid' }, label);
                        }
                        if (label === adapter) {
                            const after = await observations();
                            assert.deepEqual(after.filter(event => event.correlationId === marker).map(event => event.stage),
                                ['query authorization', 'query ordinary', 'query observer',
                                    'query authorization', 'query ordinary', 'query observer']);
                        }
                    }
                });
                // The published .NET HTTP fixture exposes direct SSE, but no direct WebSocket upgrade endpoint.
                for (const [value, allowed] of [['deny-valid', false], ['allow-valid', true]]) {
                    await t.test(`${adapter}: direct WebSocket filter ${allowed ? 'allow' : 'denial'}`, async () => {
                        const marker = randomUUID();
                        const frame = await directSocket(host.url, value, false, marker);
                        assert.equal(frame.type, 'Data');
                        assert.deepEqual(frame.data, allowed
                            ? query(200, { data: { value } }, marker) : query(403, { isAuthorized: false }, marker));
                        const after = await observations();
                        assert.deepEqual(after.filter(event => event.correlationId === marker).map(event => event.stage), allowed
                            ? ['query authorization', 'query ordinary', 'query observer'] : ['query authorization']);
                    });
                }
                await t.test(`${adapter}: direct WebSocket keeps serving after an early disconnect`, async () => {
                    await directSocket(host.url, 'allow-valid', true, randomUUID());
                    const marker = randomUUID();
                    const frame = await directSocket(host.url, 'allow-valid', false, marker);
                    assert.equal(frame.type, 'Data');
                    assert.deepEqual(frame.data, query(200, { data: { value: 'allow-valid' } }, marker));
                });
            } finally { if (adapter !== 'express') await host.stop(); }
        }
        await parity('model-bound command materializes and returns a string', 'POST', '/api/model-bound-command', { title: 'readable' }, {
            status: 200, body: command(200, { response: 'readable' })
        });
        await parity('model-bound validator returns custom state and client-cased member', 'POST', '/api/model-bound-command/validate', { title: '' }, {
            status: 400, body: command(400, { validationResults: [{ severity: 3, message: 'Title required', members: ['title'], state: 'title-owned', reason: 'rule' }] })
        });
        await parity('model-bound warning is filtered by default', 'POST', '/api/model-bound-command/validate', { title: 'ok' }, {
            status: 200, body: command(200)
        });
        await parity('model-bound warning blocks above information threshold', 'POST', '/api/model-bound-command/validate', { title: 'ok' }, {
            status: 400, body: command(400, { validationResults: [{ severity: 2, message: 'Consider a longer title', members: ['title'], reason: 'rule' }] })
        }, { 'X-Allowed-Severity': '1' });
        await parity('Guid.Empty fails NotEmpty in both model-bound validators', 'POST', '/api/guid-command/validate',
            { id: '00000000-0000-0000-0000-000000000000' }, {
                status: 400, body: command(400, { validationResults: [
                    { severity: 3, message: 'Id required', members: ['id'], reason: 'rule' }
                ] })
            });
        await parity('direct concept validator reports owning member', 'POST', '/api/validation-graph-command/validate', { rate: 0, candidates: [] }, {
            status: 400, body: command(400, { validationResults: [{ severity: 3, message: 'Rate must be positive', members: ['rate'], reason: 'rule' }] })
        });
        await parity('distinct nested concepts retain collection path', 'POST', '/api/validation-graph-command/validate', {
            rate: 1, candidates: [{ rate: 0 }, { rate: 0 }]
        }, { status: 400, body: command(400, { validationResults: [
            { severity: 3, message: 'Rate must be positive', members: ['candidates.rate'], reason: 'rule' },
            { severity: 3, message: 'Rate must be positive', members: ['candidates.rate'], reason: 'rule' }
        ] }) });
        await parity('model-bound query binds a named GET argument', 'GET', '/api/model-bound-title?TITLE=readable', undefined, {
            status: 200, body: query(200, { data: { title: 'readable' } })
        });
        await divergence('numeric concept query argument: .NET fixture returns 500, TypeScript binds it', 'GET',
            '/api/rate-lookup?RATE=12.5', undefined,
            { status: 500, body: query(500, { exceptionMessages: ['An internal error occurred while processing the request. See server logs for details.'] }) },
            { status: 200, body: query(200, { data: { value: 12.5 } }) });
        await parity('observable current-value snapshot returns 200', 'GET', '/api/fixture-stream/current', undefined, {
            status: 200, body: query(200, { data: { value: 'ready' } })
        });
        await parity('observable pending snapshot returns 202', 'GET', '/api/fixture-stream/pending', undefined, {
            status: 202, body: query(202, { isReady: false })
        });
        await parity('observable first emission is pending without a wait', 'GET', '/api/fixture-stream/first', undefined, {
            status: 202, body: query(202, { isReady: false })
        });
        await parity('observable wait receives the first emission', 'GET',
            '/api/fixture-stream/first?waitForFirstResult=true&waitForFirstResultTimeout=1', undefined, {
                status: 200, body: query(200, { data: { value: 'first' } })
            });
        await parity('observable short wait times out without a value', 'GET',
            '/api/fixture-stream/pending?waitForFirstResult=true&waitForFirstResultTimeout=0.02', undefined, {
                status: 408, body: query(408, { hasExceptions: true, exceptionMessages: [
                    'Timed out waiting 0.02 seconds for the first observable query result.'
                ] })
            });
        await parity('observable completion before the first value fails instead of reporting pending', 'GET',
            '/api/fixture-stream/completed?waitForFirstResult=true&waitForFirstResultTimeout=1', undefined, {
                status: 500, body: query(500, { exceptionMessages: [
                    'Observable query completed before producing its first result.'
                ] })
            });
        await parity('conventional model-bound query binds GUID', 'GET',
            '/api/by-id?id=11111111-1111-4111-8111-111111111111', undefined, {
                status: 200, body: query(200, { data: { value: correlationId } })
            });
        await divergence('invalid conventional GUID: .NET binds Guid.Empty, TypeScript rejects', 'GET',
            '/api/by-id?id=not-a-guid', undefined,
            { status: 200, body: query(200, { data: { value: '00000000-0000-0000-0000-000000000000' } }) },
            { status: 400, body: query(400, { validationResults: [malformedTypeScript] }) });
        await parity('tuple response validation consumes the response', 'POST', '/api/tuple-echo', { value: 'candidate' }, {
            status: 400, body: command(400, { validationResults: [{ severity: 3, message: 'Cannot echo', members: ['value'], reason: 'rule' }] })
        });
        await count('initial handler count is zero', 0);
        await parity('valid /validate does not produce a response', 'POST', '/api/echo-value/validate', { value: 'ok' }, {
            status: 200, body: command(200)
        });
        await count('valid /validate did not execute handler', 0);
        await parity('invalid /validate returns the rule', 'POST', '/api/echo-value/validate', { value: '' }, {
            status: 400, body: command(400, { validationResults: [rule] })
        });
        await count('invalid /validate did not execute handler', 0);
        await parity('invalid command rejects business rule', 'POST', '/api/echo-value', { value: '' }, {
            status: 400, body: command(400, { validationResults: [rule] })
        });
        await count('invalid command did not execute handler', 0);
        await parity('successful command echoes value', 'POST', '/api/echo-value', { value: 'hello' }, {
            status: 200, body: command(200, { response: { value: 'hello' } })
        });
        await count('successful command executed exactly once', 1);
        for (const [name, body] of [['malformed JSON', '{'], ['wrong-typed value', { value: 4 }]]) {
            await divergence(name, 'POST', '/api/echo-value', body,
                { status: 400, body: command(400, { validationResults: [malformedDotNet] }) },
                { status: 400, body: command(400, { validationResults: [malformedTypeScript] }) });
        }
        await count('malformed and wrong-typed commands did not execute handler', 1);
        const inputCount = (name, value) => parity(name, 'GET', '/api/input-case-count', undefined,
            { status: 200, body: query(200, { data: { count: value } }) });
        await inputCount('input handler has not run', 0);
        for (const [name, body] of [
            ['null input', null],
            ['wrong-typed integer input', { count: 'not-an-integer', state: 1, rate: 1 }],
            ['int32 overflow input', { count: 2147483648, state: 1, rate: 1 }],
            ['wrong-typed concept input', { count: 1, state: 1, rate: 'wrong' }]
        ]) {
            await divergence(`${name} has different malformed input text`, 'POST', '/api/input-cases', body,
                { status: 400, body: command(400, { validationResults: [malformedDotNet] }) },
                { status: 400, body: command(400, { validationResults: [malformedTypeScript] }) });
            await inputCount(`${name} did not reach the handler`, 0);
        }
        await divergence('unknown enum value is rejected during input binding', 'POST', '/api/input-cases',
            { count: 1, state: 99, rate: 1 },
            { status: 400, body: command(400, { validationResults: [malformedDotNet] }) },
            { status: 400, body: command(400, { validationResults: [malformedTypeScript] }) });
        await inputCount('unknown enum value did not reach the handler', 0);
        await parity('invalid concept input is rejected before execution', 'POST', '/api/input-cases',
            { count: 1, state: 1, rate: 0 }, { status: 400, body: command(400, { validationResults: [
                { severity: 3, message: 'Rate must be positive', members: ['rate'], reason: 'rule' }
            ] }) });
        await inputCount('invalid concept input did not reach the handler', 0);
        await parity('valid input executes once', 'POST', '/api/input-cases', { count: 5, state: 1, rate: 1 },
            { status: 200, body: command(200, { response: 5 }) });
        await inputCount('valid input reached the handler once', 1);
        const queryCaseCount = (name, value) => parity(name, 'GET', '/api/query-case-count', undefined,
            { status: 200, body: query(200, { data: { count: value } }) });
        await queryCaseCount('query performer has not run', 0);
        await parity('query validator returns a full rejection envelope', 'GET', '/api/query-case/find?value=', undefined,
            { status: 400, body: query(400, { validationResults: [rule] }) });
        await queryCaseCount('query validator did not execute the performer', 0);
        await parity('valid query invokes the performer', 'GET', '/api/query-case/find?value=ok', undefined,
            { status: 200, body: query(200, { data: { value: 'ok' } }) });
        await queryCaseCount('valid query executed exactly once', 1);
        await divergence('throwing query performer redacts different message text', 'GET', '/api/query-case/fail', undefined,
            { status: 500, body: query(500, { exceptionMessages: netReaderFailure.exceptionMessages }) },
            { status: 500, body: query(500, { exceptionMessages: tsReaderFailure.exceptionMessages }) });
        await parity('authenticated Reader denied before validation leaks', 'POST', '/api/admin-echo', { value: '' }, {
            status: 403, body: command(403)
        }, { 'X-Fixture-Role': 'Reader' });
        await parity('authenticated Reader denied validation-only command', 'POST', '/api/admin-echo/validate', { value: '' }, {
            status: 403, body: command(403)
        }, { 'X-Fixture-Role': 'Reader' });
        await divergence('anonymous authorization ingress: ASP.NET 403, TypeScript 401', 'POST', '/api/admin-echo', { value: '' },
            { status: 403, body: command(403) }, { status: 401, body: command(401) });
        await parity('authorized administrator still fails the business rule', 'POST', '/api/admin-echo', { value: '' }, {
            status: 400, body: command(400, { validationResults: [rule] })
        }, { 'X-Fixture-Role': 'Admin' });
        await divergence('TypeScript does not let HTTP severity disable business errors', 'POST', '/api/admin-echo', { value: '' },
            { status: 200, body: command(200, { response: { value: '' } }) },
            { status: 400, body: command(400, { validationResults: [rule] }) },
            { 'X-Fixture-Role': 'Admin', 'X-Allowed-Severity': '3' });
        await parity('administrator allowed command', 'POST', '/api/admin-echo', { value: 'ok' }, {
            status: 200, body: command(200, { response: { value: 'ok' } })
        }, { 'X-Fixture-Role': 'Admin' });
        await parity('named policy allows administrator command', 'POST', '/api/policy-echo', { value: 'ok' }, {
            status: 200, body: command(200, { response: { value: 'ok' } })
        }, { 'X-Fixture-Role': 'Admin' });
        await parity('named policy denies Reader before command validation', 'POST', '/api/policy-echo', { value: '' }, {
            status: 403, body: command(403)
        }, { 'X-Fixture-Role': 'Reader' });
        await parity('named policy denies Reader on validation-only route', 'POST', '/api/policy-echo/validate', { value: '' }, {
            status: 403, body: command(403)
        }, { 'X-Fixture-Role': 'Reader' });
        await parity('named policy allows administrator query', 'GET', '/api/policy-items', undefined, {
            status: 200, body: query(200, { data: { value: 'allowed' } })
        }, { 'X-Fixture-Role': 'Admin' });
        await parity('named policy denies Reader query', 'GET', '/api/policy-items', undefined, {
            status: 403, body: query(403)
        }, { 'X-Fixture-Role': 'Reader' });
        await parity('error severity still blocks at Warning threshold', 'POST', '/api/admin-echo/validate', { value: '' }, {
            status: 400, body: command(400, { validationResults: [rule] })
        }, { 'X-Fixture-Role': 'Admin', 'X-Allowed-Severity': '2' });
        await parity('acronym names, numeric enums and named float literals', 'GET', '/api/http-metric', undefined, {
            status: 200, body: query(200, { data: { HTTPCount: 'Infinity', recordedValue: 'NaN', state: 1 } })
        });
        for (const literal of ['NaN', 'Infinity', '-Infinity']) {
            await parity(`named floating point input ${literal}`, 'POST', '/api/echo-metric', { value: literal }, {
                status: 200, body: command(200, { response: { value: literal } })
            });
        }
        await parity('GET binds case-insensitive query argument', 'GET', '/api/items/by-id?ID=2', undefined, {
            status: 200, body: query(200, { data: { id: 2, name: 'Grace' } })
        });
        await parity('QUERY binds case-insensitive structured arguments and disables caching', 'QUERY', '/api/items/by-id', { arguments: { ID: 2 } }, {
            status: 200, body: query(200, { data: { id: 2, name: 'Grace' } }), headers: { 'cache-control': 'no-store' }
        }, {}, ['cache-control']);
        await parity('GET int32 parsing accepts leading zeros', 'GET', '/api/items?pageSize=02', undefined, {
            status: 200, body: query(200, { data: items.slice(0, 2), paging: paging(0, 2, 3, 2) })
        });
        await parity('GET int32 parsing accepts a leading plus and whitespace', 'GET', '/api/items?pageSize=%20%2B2%20', undefined, {
            status: 200, body: query(200, { data: items.slice(0, 2), paging: paging(0, 2, 3, 2) })
        });
        await parity('GET pages array with counts', 'GET', '/api/items?page=0&pageSize=2', undefined, {
            status: 200, body: query(200, { data: items.slice(0, 2), paging: paging(0, 2, 3, 2) })
        });
        await parity('QUERY pages and sorts descending with no-store', 'QUERY', '/api/items', {
            paging: { page: 0, pageSize: 2 }, sorting: { field: 'name', direction: 'desc' }
        }, { status: 200, body: query(200, { data: [items[2], items[1]], paging: paging(0, 2, 3, 2) }), headers: { 'cache-control': 'no-store' } }, {}, ['cache-control']);
        await parity('QUERY second page carries totals', 'QUERY', '/api/items', { paging: { page: 1, pageSize: 2 } }, {
            status: 200, body: query(200, { data: [items[2]], paging: paging(1, 2, 3, 2) }), headers: { 'cache-control': 'no-store' }
        }, {}, ['cache-control']);
        await divergence('GET sort: .NET fixture ignores descending sort, TypeScript applies it', 'GET',
            '/api/items?page=0&pageSize=2&sortBy=name&sortDirection=desc', undefined,
            { status: 200, body: query(200, { data: items.slice(0, 2), paging: paging(0, 2, 3, 2) }) },
            { status: 200, body: query(200, { data: [items[2], items[1]], paging: paging(0, 2, 3, 2) }) });
        await queryCount('item query count before rejected requests', 6);
        await parity('GET ignores negative page when pageSize is nonnumeric', 'GET',
            '/api/items?page=-1&pageSize=abc', undefined, { status: 200, body: query(200, { data: items }) });
        await queryParity('QUERY rejects invalid sort direction with owning member',
            { sorting: { field: 'name', direction: 'sideways' } }, { status: 400, body: badDirection('sorting.direction') });
        await parity('GET rejects negative page with a paging rule', 'GET', '/api/items?page=-1&pageSize=2', undefined,
            { status: 400, body: pagingRule('Page number must be greater than or equal to 0', 'Page') });
        await parity('GET reports Page then Size for both invalid paging values', 'GET', '/api/items?page=-1&pageSize=0', undefined,
            { status: 400, body: query(400, { validationResults: [
                { severity: 3, message: 'Page number must be greater than or equal to 0', members: ['Page'], reason: 'rule' },
                { severity: 3, message: 'Page size must be greater than 0', members: ['Size'], reason: 'rule' }
            ] }) });
        for (const size of [0, -1]) {
            await parity(`GET rejects pageSize=${size} with a paging rule`, 'GET', `/api/items?page=0&pageSize=${size}`, undefined,
                { status: 400, body: pagingRule('Page size must be greater than 0', 'Size') });
        }
        await queryParity('QUERY rejects negative page with a paging rule', { paging: { page: -1, pageSize: 2 } },
            { status: 400, body: pagingRule('Page number must be greater than or equal to 0', 'Page') });
        for (const size of [0, -1]) {
            await queryParity(`QUERY pageSize=${size} is unpaged`, { paging: { page: 0, pageSize: size } },
                { status: 200, body: query(200, { data: items }) });
        }
        const hugePage = paging(2147483647, 2147483647, 3, 1);
        await parity('GET clamps overflowing int32 page multiplication', 'GET',
            '/api/items?page=2147483647&pageSize=2147483647', undefined,
            { status: 200, body: query(200, { data: [], paging: hugePage }) });
        await queryParity('QUERY clamps overflowing int32 page multiplication',
            { paging: { page: 2147483647, pageSize: 2147483647 } },
            { status: 200, body: query(200, { data: [], paging: hugePage }) });
        for (const [name, path, expected] of [
            ['GET page beyond int32 defaults to zero', '/api/items?page=2147483648&pageSize=2', query(200, { data: items.slice(0, 2), paging: paging(0, 2, 3, 2) })],
            ['GET pageSize beyond int32 defaults to unpaged', '/api/items?page=0&pageSize=2147483648', query(200, { data: items })],
            ['GET nonnumeric page defaults to zero', '/api/items?page=no&pageSize=2', query(200, { data: items.slice(0, 2), paging: paging(0, 2, 3, 2) })],
            ['GET nonnumeric pageSize defaults to unpaged', '/api/items?page=0&pageSize=no', query(200, { data: items })]
        ]) await parity(name, 'GET', path, undefined, { status: 200, body: expected });
        await queryParity('QUERY paging with only page is unpaged', { paging: { page: 1 } },
            { status: 200, body: query(200, { data: items }) });
        await queryParity('QUERY paging with only pageSize defaults page to zero', { paging: { pageSize: 2 } },
            { status: 200, body: query(200, { data: items.slice(0, 2), paging: paging(0, 2, 3, 2) }) });
        await queryParity('QUERY ignores unknown envelope members', { extra: 'ignored' },
            { status: 200, body: query(200, { data: items }) });
        await queryParity('QUERY ignores unknown paging members', { paging: { pageSize: 2, extra: 1 } },
            { status: 200, body: query(200, { data: items.slice(0, 2), paging: paging(0, 2, 3, 2) }) });
        await queryParity('QUERY ignores unknown sorting members', { sorting: { field: 'name', direction: 'desc', extra: 1 } },
            { status: 200, body: query(200, { data: [...items].reverse() }) });
        await queryParity('QUERY direction without field is unpaged and unsorted', { sorting: { direction: 'desc' } },
            { status: 200, body: query(200, { data: items }) });
        await parity('GET nonbreaking whitespace is not int32 whitespace', 'GET', '/api/items?page=-1&pageSize=%C2%A02',
            undefined, { status: 200, body: query(200, { data: items }) });
        for (const [name, body] of [
            ['null body', null], ['null paging', { paging: null }],
            ['null sorting', { sorting: null }], ['null arguments', { arguments: null }]
        ]) await queryParity(`QUERY ${name} is absent`, body, { status: 200, body: query(200, { data: items }) });
        await queryCount('item query count before malformed QUERY bodies', 26);
        for (const [name, body] of [
            ['invalid JSON', '{'], ['array body', []], ['wrong-typed paging', { paging: 'wrong' }],
            ['wrong-typed sorting', { sorting: 'wrong' }], ['wrong-typed arguments', { arguments: [] }],
            ['nonstring sort field', { sorting: { field: 3 } }],
            ['nonstring sort direction', { sorting: { field: 'name', direction: 3 } }],
            ['nonnumeric page', { paging: { page: 'no', pageSize: 2 } }],
            ['nonnumeric page without size', { paging: { page: 'no' } }],
            ['page beyond int32', { paging: { page: 2147483648, pageSize: 2 } }],
            ['pageSize beyond int32', { paging: { page: 0, pageSize: 2147483648 } }]
        ]) await readerDifference(`QUERY ${name}: .NET and TypeScript redacted exception texts differ`, body);
        await queryCount('malformed QUERY bodies did not execute item query handler', 26);
        await divergence('QUERY rejects invalid sorting field only in TypeScript', 'QUERY', '/api/items',
            { sorting: { field: 'name!', direction: 'asc' } },
            { status: 500, body: query(500, { exceptionMessages: netReaderFailure.exceptionMessages }),
                headers: { 'cache-control': 'no-store' } },
            { status: 400, body: query(400, { validationResults: [malformedTypeScript] }), headers: { 'cache-control': 'no-store' } },
            {}, ['cache-control']);
        await divergence('QUERY rejects undeclared argument names only in TypeScript', 'QUERY', '/api/items',
            { arguments: { extra: 'ignored' } },
            { status: 200, body: query(200, { data: items }), headers: { 'cache-control': 'no-store' } },
            { status: 400, body: query(400, { validationResults: [malformedTypeScript] }), headers: { 'cache-control': 'no-store' } },
            {}, ['cache-control']);
        await divergence('QUERY null page and size default only in TypeScript', 'QUERY', '/api/items',
            { paging: { page: null, pageSize: null } },
            { status: 400, body: netReaderFailure, headers: { 'cache-control': 'no-store' } },
            { status: 200, body: query(200, { data: items }), headers: { 'cache-control': 'no-store' } },
            {}, ['cache-control']);
        for (const [name, body] of [
            ['decimal integer token', '{"paging":{"pageSize":2.0}}'],
            ['exponent integer token', '{"paging":{"pageSize":2e0}}']
        ]) await divergence(`QUERY ${name}: TypeScript accepts JSON numeric normalization`, 'QUERY', '/api/items', body,
            { status: 400, body: netReaderFailure, headers: { 'cache-control': 'no-store' } },
            { status: 200, body: query(200, { data: items.slice(0, 2), paging: paging(0, 2, 3, 2) }),
                headers: { 'cache-control': 'no-store' } }, {}, ['cache-control']);
        await divergence('GET sort: .NET 22.23.0 ignores even an invalid direction (#2758); TypeScript rejects it', 'GET',
            '/api/items?sortBy=name&sortDirection=sideways', undefined,
            { status: 200, body: query(200, { data: items }) },
            { status: 400, body: badDirection('sortDirection') });
        await parity('anonymous override on authorized read model', 'GET', '/api/auth-override/public', undefined,
            { status: 200, body: query(200, { data: { value: 'public' } }) });
        await parity('authenticated caller reaches class-authorized method', 'GET', '/api/auth-override/private', undefined,
            { status: 200, body: query(200, { data: { value: 'private' } }) }, { 'X-Fixture-Role': 'Reader' });
        await divergence('class-authorized method denies anonymous: .NET 403, TypeScript 401', 'GET',
            '/api/auth-override/private', undefined, { status: 403, body: query(403) }, { status: 401, body: query(401) });
        for (const role of ['Admin', 'Reader']) {
            await parity(`class-level OR role accepts ${role}`, 'GET', '/api/role-cases/either', undefined,
                { status: 200, body: query(200, { data: { value: 'either' } }) }, { 'X-Fixture-Role': role });
        }
        await parity('method Admin replaces class Admin or Reader', 'GET', '/api/role-cases/both', undefined,
            { status: 200, body: query(200, { data: { value: 'both' } }) }, { 'X-Fixture-Role': 'Admin' });
        await parity('method Admin rejects Reader despite class OR', 'GET', '/api/role-cases/both', undefined,
            { status: 403, body: query(403) }, { 'X-Fixture-Role': 'Reader' });
        await divergence('class roles deny anonymous: .NET 403, TypeScript 401', 'GET',
            '/api/role-cases/either', undefined, { status: 403, body: query(403) }, { status: 401, body: query(401) });
        await parity('method Reader overrides anonymous class for Reader', 'GET', '/api/role-cases/anonymous-class', undefined,
            { status: 200, body: query(200, { data: { value: 'reader' } }) }, { 'X-Fixture-Role': 'Reader' });
        await parity('method Reader denies Admin despite anonymous class', 'GET', '/api/role-cases/anonymous-class', undefined,
            { status: 403, body: query(403) }, { 'X-Fixture-Role': 'Admin' });
        await parity('method Reader replaces class Admin for Reader', 'GET', '/api/role-cases/replacement', undefined,
            { status: 200, body: query(200, { data: { value: 'reader' } }) }, { 'X-Fixture-Role': 'Reader' });
        await parity('method Reader rejects class-only Admin', 'GET', '/api/role-cases/replacement', undefined,
            { status: 403, body: query(403) }, { 'X-Fixture-Role': 'Admin' });
        await divergence('method roles deny anonymous: .NET 403, TypeScript 401', 'GET',
            '/api/role-cases/both', undefined, { status: 403, body: query(403) }, { status: 401, body: query(401) });
        await parity('authenticated Reader denied private query', 'GET', '/api/items/private', undefined, {
            status: 403, body: query(403)
        }, { 'X-Fixture-Role': 'Reader' });
        await parity('administrator allowed private query', 'GET', '/api/items/private', undefined, {
            status: 200, body: query(200, { data: items })
        }, { 'X-Fixture-Role': 'Admin' });
        await divergence('production exception message differs but stack is redacted', 'POST', '/api/throw-failure', {},
            { status: 500, body: command(500, { exceptionMessages: ['An internal error occurred while processing the request. See server logs for details.'] }) },
            { status: 500, body: command(500, { exceptionMessages: ['An unexpected error occurred'] }) });
        await t.test('missing route is 404: .NET empty, Express HTML and no Arc header', async context => {
            const [net, ts] = await send('GET', '/api/does-not-exist');
            assert.equal(net.status, 404);
            assert.equal(net.body, '');
            assert.equal(net.headers[correlationHeader], correlationId);
            assert.equal(net.headers['content-type'], undefined);
            assert.equal(ts.status, 404);
            assert.match(ts.body, /Cannot GET \/api\/does-not-exist/);
            assert.match(ts.headers['content-type'], /^text\/html/);
            assert.equal(ts.headers[correlationHeader], undefined);
            context.diagnostic(`UNSUPPORTED PARITY: missing route: .NET ${JSON.stringify({ status: net.status, body: net.body, correlation: net.headers[correlationHeader] })} vs Express ${JSON.stringify({ status: ts.status, body: ts.body, correlation: ts.headers[correlationHeader] })}`);
        });
        await t.test('unsupported method returns 405 with Allow: POST', async () => {
            const [net, ts] = await send('PUT', '/api/echo-value');
            for (const [label, actual] of [['.NET', net], ['TypeScript', ts]]) {
                assert.equal(actual.status, 405, label);
                assert.equal(actual.body, '', label);
                assert.equal(actual.headers.allow, 'POST', label);
                assert.equal(actual.headers['content-type'], undefined, label);
                assert.equal(actual.headers[correlationHeader], correlationId, label);
            }
            assert.deepEqual(normalize(net, { headers: [correlationHeader, 'allow'] }), normalize(ts, { headers: [correlationHeader, 'allow'] }));
        });
        await parity('unknown command fields are ignored', 'POST', '/api/echo-value', { value: 'extra', extra: 'ignored' }, {
            status: 200, body: command(200, { response: { value: 'extra' } })
        });
        await count('unknown-field command executed exactly once', 2);
        await t.test('invalid correlation replaced by UUID matching header and body', async () => {
            const [net, ts] = await send('POST', '/api/echo-value/validate', { value: 'ok' }, { 'X-Correlation-ID': 'invalid' });
            for (const [label, actual] of [['.NET', net], ['TypeScript', ts]]) {
                const normalized = normalize(actual, { randomCorrelation: true, headers: [correlationHeader, 'content-type'] });
                assert.equal(actual.status, 200, label);
                assert.deepEqual(normalized.body, command(200, {}, '<generated UUID>'), label);
                assert.equal(actual.headers['content-type'], 'application/json; charset=utf-8', label);
            }
            assert.deepEqual(normalize(net, { randomCorrelation: true, headers: [correlationHeader, 'content-type'] }),
                normalize(ts, { randomCorrelation: true, headers: [correlationHeader, 'content-type'] }));
        });
        await count('invalid correlation validation did not execute handler', 2);
        const alternateId = '22222222-2222-4222-8222-222222222222';
        for (const [name, method, path, body, netExpected, tsExpected, headers] of [
            ['command 400', 'POST', '/api/input-cases', { count: 'bad', state: 1, rate: 1 },
                command(400, { validationResults: [malformedDotNet] }, alternateId),
                command(400, { validationResults: [malformedTypeScript] }, alternateId)],
            ['query 400', 'GET', '/api/query-case/find?value=', undefined,
                query(400, { validationResults: [rule] }, alternateId), query(400, { validationResults: [rule] }, alternateId)],
            ['command 403', 'POST', '/api/admin-echo', { value: 'ok' },
                command(403, {}, alternateId), command(403, {}, alternateId), { 'X-Fixture-Role': 'Reader' }],
            ['query 403', 'GET', '/api/items/private', undefined,
                query(403, {}, alternateId), query(403, {}, alternateId), { 'X-Fixture-Role': 'Reader' }],
            ['command 500', 'POST', '/api/throw-failure', {},
                command(500, { exceptionMessages: netReaderFailure.exceptionMessages }, alternateId),
                command(500, { exceptionMessages: tsReaderFailure.exceptionMessages }, alternateId)],
            ['query 500', 'GET', '/api/query-case/fail', undefined,
                query(500, { exceptionMessages: netReaderFailure.exceptionMessages }, alternateId),
                query(500, { exceptionMessages: tsReaderFailure.exceptionMessages }, alternateId)],
            ['query 202', 'GET', '/api/fixture-stream/pending', undefined,
                query(202, { isReady: false }, alternateId), query(202, { isReady: false }, alternateId)]
        ]) {
            await t.test(`supplied correlation ID echoes on ${name}`, async () => {
                const [net, ts] = await send(method, path, body, { 'X-Correlation-ID': alternateId, ...headers });
                for (const [label, actual, expected] of [['.NET', net, netExpected], ['TypeScript', ts, tsExpected]]) {
                    assert.equal(actual.status, Number(name.split(' ')[1]), label);
                    assert.deepEqual(actual.body, expected, label);
                    assert.equal(actual.headers[correlationHeader], alternateId, label);
                }
            });
        }
        for (const [name, incoming] of [['zero UUID', '00000000-0000-0000-0000-000000000000'], ['missing header', undefined]]) {
            for (const [status, method, path, body, envelope] of [
                [400, 'POST', '/api/echo-value/validate', { value: '' }, command(400, { validationResults: [rule] }, '<generated UUID>')],
                [202, 'GET', '/api/fixture-stream/pending', undefined, query(202, { isReady: false }, '<generated UUID>')]
            ]) {
                await t.test(`${name} generates correlated ${status} envelope`, async () => {
                    const headers = incoming === undefined ? {} : { 'X-Correlation-ID': incoming };
                    const [net, ts] = await Promise.all([
                        request(dotnet.url, method, path, body, headers), request(typescript.url, method, path, body, headers)
                    ]);
                    for (const [label, actual] of [['.NET', net], ['TypeScript', ts]]) {
                        const normalized = normalize(actual, { randomCorrelation: true, headers: [correlationHeader, 'content-type'] });
                        assert.equal(actual.status, status, label);
                        assert.deepEqual(normalized.body, envelope, label);
                    }
                });
            }
        }
        await divergence('QUERY oversized body hits the TypeScript-only hosting limit', 'QUERY', '/api/items',
            { extra: 'x'.repeat(1024 * 1024) },
            { status: 200, body: query(200, { data: items }), headers: { 'cache-control': 'no-store' } },
            { status: 400, body: query(400, { validationResults: [malformedTypeScript] }), headers: { 'cache-control': 'no-store' } },
            {}, ['cache-control']);
    } finally {
        await Promise.all([typescript?.stop(), dotnet.stop()]);
    }
});
