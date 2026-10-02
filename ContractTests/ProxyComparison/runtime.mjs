// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Guid, JsonSerializer } from '@cratis/fundamentals';
import { QueryHttpMethod, SortingActions } from '@cratis/arc/queries';
import { ArcServer, defineQuery } from '@cratis/arc.core';
import { z } from 'zod';
import { startServer } from '../Http/harness.mjs';
import { root } from './generate.mjs';

const [bundle, family, live] = process.argv.slice(2);
const { All, Observe, Register, RegisterValidator, Listing, Detail, Notice, UrgentNotice, Status } = await import(pathToFileURL(bundle).href);
const id = 'dcfd0ec2-679e-4af7-a43c-8421b91f74d3';
const created = '2026-01-02T03:04:05.000Z';
const wire = { name: 'paired', detail: { id, created }, status: 1,
    notice: { _derivedTypeId: '1578f20a-cd63-456f-98aa-c97daf05d0fa', title: 'urgent', priority: 7 } };
const command = new Register();
assert.equal(command.route, '/api/proxy-comparison/register');
assert.deepEqual(command.requestParameters, []);
assert.deepEqual(command.roles, []);
assert.equal(command.treatWarningsAsErrors, false);
assert.deepEqual(command.propertyDescriptors.map(({ name, type, isOptional }) => [name, type, isOptional]), [
    ['id', Guid, false], ['name', String, false], ['quantity', Number, false]
]);
assert.ok(command.validation instanceof RegisterValidator);
const validation = (name, quantity) => command.validation.validate({ id: Guid.parse(id), name, quantity }).map(result => result.message).sort();
assert.deepEqual(validation('valid', 1), []);
assert.deepEqual(validation('', 0), ['Name required', 'Quantity must be positive']);
assert.deepEqual(validation('x'.repeat(41), 1), ['Name too long']);
assert.deepEqual(validation('x'.repeat(40), 1), []);

const rows = [
    { name: 'charlie', detail: { id, created: '2026-01-03T03:04:05Z' }, notice: { title: 'third' }, status: 0 },
    { name: 'alpha', detail: { id, created: '2026-01-01T03:04:05Z' }, notice: { title: 'first' }, status: 1 },
    { name: 'bravo', detail: { id, created: '2026-01-02T03:04:05Z' }, notice: { title: 'second' }, status: 0 }
];
const originalOrder = rows.map(row => row.name);
const typescript = new ArcServer({ introspection: { enabled: false }, queries: [[All, 'All'], [Observe, 'Observe']].map(([Query, name]) => defineQuery({
    name, path: new Query().route, schema: z.object({ id: z.string() }), perform: () => structuredClone(rows)
})) });
const fetchBefore = globalThis.fetch;
let dotnet;
try {
    if (live === '--dotnet-server') dotnet = await startServer('dotnet', ['ContractTests/DotNET/bin/Debug/net10.0/Arc.TypeScript.HttpFixture.dll'], {
        cwd: root, kind: 'typescript-dotnet-reference-ready'
    });
    for (const [Query, method] of [[All, 'all'], [Observe, 'observe']]) {
        const query = new Query();
        assert.equal(query.route, `/api/proxy-comparison/${method}`);
        assert.equal(query.queryName, `ProxyComparison.Listing.${Query === All ? 'All' : 'Observe'}`);
        assert.deepEqual(query.defaultValue, []);
        assert.deepEqual(query.requiredRequestParameters, ['id']);
        assert.deepEqual(query.parameterDescriptors.map(({ name, type, isEnumerable }) => [name, type, isEnumerable]), [['id', Guid, false]]);
        query.setOrigin('http://comparison.invalid');
        query.setHttpMethod(QueryHttpMethod.Get);
        let calls = 0;
        globalThis.fetch = async (input, options) => {
            calls++;
            const url = new URL(input);
            assert.equal(url.pathname, query.route);
            assert.equal(url.searchParams.get('id'), id);
            assert.equal(options.method, 'GET');
            return new Response(JSON.stringify({ data: [wire], isSuccess: true, isAuthorized: true, isValid: true, hasExceptions: false,
                validationResults: [], exceptionMessages: [], exceptionStackTrace: '', paging: { page: 0, size: 1, totalItems: 1, totalPages: 1 } }),
                { headers: { 'Content-Type': 'application/json' } });
        };
        const result = await query.perform({ id: Guid.parse(id) });
        assert.equal(calls, 1);
        assert.equal(result.isSuccess, true, JSON.stringify(result));
        assert.equal(result.data.length, 1);
        const model = result.data[0];
        assert.ok(model instanceof Listing);
        assert.ok(model.detail instanceof Detail);
        assert.ok(model.detail.id instanceof Guid);
        assert.equal(model.detail.id.toString(), id);
        assert.ok(model.detail.created instanceof Date);
        assert.equal(model.detail.created.toISOString(), created);
        assert.ok(model.notice instanceof Notice);
        assert.ok(model.notice instanceof UrgentNotice);
        assert.equal(model.notice.title, 'urgent');
        assert.equal(model.notice.priority, 7);
        assert.equal(model.status, 1);
        assert.deepEqual(JSON.parse(JsonSerializer.serialize(model)), wire);
        // Arc#2998: .NET's query-parameter helper is a defect, not an intentional API difference.
        const sortNames = family === 'DotNET' ? ['id'] : ['name', 'detail', 'notice', 'status'];
        for (const name of sortNames) { assert.ok(query.sortBy[name]); assert.ok(Query.sortBy[name]); }
        assert.equal(query.sortBy[family === 'DotNET' ? 'name' : 'id'], undefined);
        for (const hook of ['use', 'useWithPaging', 'useSuspense', 'useSuspenseWithPaging', 'when']) assert.equal(typeof Query[hook], 'function');

        // Send the generated Sorting through the real browser client and TS HTTP query pipeline.
        // Full regeneration also sends All through the pinned .NET IQueryable pipeline.
        for (const backend of ['TypeScript', ...(dotnet && Query === All ? ['DotNET'] : [])]) {
            query.setOrigin(backend === 'DotNET' ? dotnet.url : 'http://comparison.invalid');
            let status;
            let sentField;
            globalThis.fetch = async (input, options) => {
                const url = new URL(input);
                sentField = url.searchParams.get('sortBy');
                const response = backend === 'TypeScript'
                    ? await typescript.handle(new Request(input, options))
                    : await fetchBefore(input, { ...options, signal: AbortSignal.timeout(10000) });
                assert.ok(response, `No ${backend} sorting route`);
                status = response.status;
                return response;
            };
            // A working scalar control prevents an unrelated server/route failure satisfying the defect check.
            query.sorting = new SortingActions('name').ascending;
            const control = await query.perform({ id: Guid.parse(id) });
            assert.equal(status, 200, JSON.stringify(control));
            assert.equal(control.isSuccess, true);
            assert.deepEqual(control.data.map(row => row.name), ['alpha', 'bravo', 'charlie']);
            for (const name of sortNames) {
                for (const direction of ['ascending', 'descending']) {
                    const sorting = Query.sortBy[name][direction];
                    assert.equal(sorting.field, name);
                    assert.deepEqual(query.sortBy[name][direction](), sorting, 'Instance and static helpers agree');
                    query.sorting = sorting;
                    const sorted = await query.perform({ id: Guid.parse(id) });
                    assert.equal(sentField, name, 'The browser client must send the field unchanged');
                    if (name === 'id' || backend === 'DotNET' && ['detail', 'notice'].includes(name)) {
                        // Arc#2998: id is not a result field. Arc.TypeScript#174: complex fields are not comparable.
                        assert.equal(status, backend === 'DotNET' ? 500 : 400, JSON.stringify(sorted));
                        assert.equal(sorted.isSuccess, false);
                        assert.equal(sorted.hasExceptions, backend === 'DotNET');
                    } else {
                        assert.equal(status, 200, JSON.stringify(sorted));
                        assert.equal(sorted.isSuccess, true);
                        const expected = name === 'name'
                            ? direction === 'ascending' ? ['alpha', 'bravo', 'charlie'] : ['charlie', 'bravo', 'alpha']
                            : name === 'status'
                                ? direction === 'ascending' ? ['charlie', 'bravo', 'alpha'] : ['alpha', 'charlie', 'bravo']
                                : originalOrder; // Arc.TypeScript#174: distinct complex values currently sort as a no-op.
                        assert.deepEqual(sorted.data.map(row => row.name), expected, `${family}/${Query.name} ${backend} ${name} ${direction}`);
                    }
                }
            }
        }
    }
    assert.equal(typeof Observe.useChangeStream, 'function');
    assert.equal(typeof Register.use, 'function');
    assert.equal(Status[family === 'DotNET' ? 'draft' : 'Draft'], 0);
    assert.equal(Status[family === 'DotNET' ? 'published' : 'Published'], 1);
} finally {
    globalThis.fetch = fetchBefore;
    try { await dotnet?.stop(); } finally { await typescript.dispose(); }
}
console.log(`${family}: browser-client contracts and sorting behavior passed (${dotnet ? 'TypeScript and live .NET servers' : 'TypeScript server; live .NET skipped'})`);
