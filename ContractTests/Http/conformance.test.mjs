// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
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
        const send = async (method, path, body, headers = {}) => {
            const options = { 'X-Correlation-ID': correlationId, ...headers };
            return Promise.all([request(dotnet.url, method, path, body, options), request(typescript.url, method, path, body, options)]);
        };
        const check = (actual, expected, label, headerNames = [correlationHeader, 'content-type']) => {
            assert.equal(actual.status, expected.status, `${label}: status; body=${JSON.stringify(actual.body)}`);
            assert.deepEqual(actual.body, expected.body, `${label}: full envelope`);
            for (const [name, value] of Object.entries(expected.headers ?? { [correlationHeader]: correlationId })) {
                assert.equal(actual.headers[name], value, `${label}: ${name}`);
            }
            return normalize(actual, { headers: headerNames });
        };
        const parity = async (name, method, path, body, expected, headers = {}, extraHeaders = []) => t.test(name, async () => {
            const [net, ts] = await send(method, path, body, headers);
            const expectedResponse = { status: expected.status, body: expected.body, headers: {
                [correlationHeader]: correlationId, 'content-type': 'application/json; charset=utf-8', ...expected.headers
            } };
            const selected = [correlationHeader, 'content-type', ...extraHeaders];
            const left = check(net, expectedResponse, '.NET', selected);
            const right = check(ts, expectedResponse, 'TypeScript', selected);
            assert.deepEqual(right, left, `${name}: protocol parity`);
        });
        const divergence = async (name, method, path, body, dotnetExpected, typescriptExpected, headers = {}) => t.test(name, async context => {
            const [net, ts] = await send(method, path, body, headers);
            check(net, { status: dotnetExpected.status, body: dotnetExpected.body, headers: { [correlationHeader]: correlationId, 'content-type': 'application/json; charset=utf-8', ...dotnetExpected.headers } }, '.NET');
            check(ts, { status: typescriptExpected.status, body: typescriptExpected.body, headers: { [correlationHeader]: correlationId, 'content-type': 'application/json; charset=utf-8', ...typescriptExpected.headers } }, 'TypeScript');
            assert.notDeepEqual({ status: net.status, body: net.body }, { status: ts.status, body: ts.body }, 'documented divergence remains visible');
            context.diagnostic(`UNSUPPORTED PARITY: ${name}: .NET ${JSON.stringify({ status: net.status, body: net.body })} vs TypeScript ${JSON.stringify({ status: ts.status, body: ts.body })}`);
        });
        const count = (name, value) => parity(name, 'GET', '/api/echo-count', undefined, {
            status: 200, body: query(200, { data: { count: value } })
        });

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
    } finally {
        await Promise.all([typescript?.stop(), dotnet.stop()]);
    }
});
