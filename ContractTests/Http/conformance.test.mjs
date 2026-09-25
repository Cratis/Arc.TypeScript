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
const netReaderFailure = query(400, { isValid: true, hasExceptions: true, exceptionMessages: [
    'An internal error occurred while processing the request. See server logs for details.'
] });
const tsReaderFailure = query(400, { isValid: true, hasExceptions: true, exceptionMessages: ['An unexpected error occurred'] });
const pagingRule = (message, member) => query(400, { validationResults: [{ severity: 3, message, members: [member], reason: 'rule' }] });
const badDirection = member => query(400, { validationResults: [{ severity: 3,
    message: 'The sort direction is not a recognized value.', members: [member], reason: 'malformedRequest' }] });

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
        const divergence = async (name, method, path, body, dotnetExpected, typescriptExpected, headers = {}, extraHeaders = []) => t.test(name, async context => {
            const [net, ts] = await send(method, path, body, headers);
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
        await queryCount('item query count before malformed QUERY bodies', 20);
        for (const [name, body] of [
            ['invalid JSON', '{'], ['array body', []], ['wrong-typed paging', { paging: 'wrong' }],
            ['wrong-typed sorting', { sorting: 'wrong' }], ['wrong-typed arguments', { arguments: [] }],
            ['nonnumeric page', { paging: { page: 'no', pageSize: 2 } }],
            ['nonnumeric page without size', { paging: { page: 'no' } }],
            ['page beyond int32', { paging: { page: 2147483648, pageSize: 2 } }],
            ['pageSize beyond int32', { paging: { page: 0, pageSize: 2147483648 } }]
        ]) await readerDifference(`QUERY ${name}: .NET and TypeScript redacted exception texts differ`, body);
        await queryCount('malformed QUERY bodies did not execute item query handler', 20);
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
        await divergence('QUERY oversized body hits the TypeScript-only hosting limit', 'QUERY', '/api/items',
            { extra: 'x'.repeat(1024 * 1024) },
            { status: 200, body: query(200, { data: items }), headers: { 'cache-control': 'no-store' } },
            { status: 400, body: query(400, { validationResults: [malformedTypeScript] }), headers: { 'cache-control': 'no-store' } },
            {}, ['cache-control']);
    } finally {
        await Promise.all([typescript?.stop(), dotnet.stop()]);
    }
});
