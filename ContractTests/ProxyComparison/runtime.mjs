// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { Guid, JsonSerializer } from '@cratis/fundamentals';
import { QueryHttpMethod } from '@cratis/arc/queries';

const [bundle, family] = process.argv.slice(2);
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

const fetchBefore = globalThis.fetch;
try {
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
        // These differences are deliberately retained rather than changing TS APIs to copy .NET output.
        const sortNames = family === 'DotNET' ? ['id'] : ['name', 'detail', 'notice', 'status'];
        for (const name of sortNames) { assert.ok(query.sortBy[name]); assert.ok(Query.sortBy[name]); }
        assert.equal(query.sortBy[family === 'DotNET' ? 'name' : 'id'], undefined);
        for (const hook of ['use', 'useWithPaging', 'useSuspense', 'useSuspenseWithPaging', 'when']) assert.equal(typeof Query[hook], 'function');
    }
    assert.equal(typeof Observe.useChangeStream, 'function');
    assert.equal(typeof Register.use, 'function');
    assert.equal(Status[family === 'DotNET' ? 'draft' : 'Draft'], 0);
    assert.equal(Status[family === 'DotNET' ? 'published' : 'Published'], 1);
} finally {
    globalThis.fetch = fetchBefore;
}
console.log(`${family}: browser-client contracts passed`);
