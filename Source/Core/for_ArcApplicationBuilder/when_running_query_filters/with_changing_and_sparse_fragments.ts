// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import { Severity } from '../../validation/Severity.js';
import { validation } from '../../validation/ValidationResult.js';
import { query_filter_fixture } from '../given/query_filter_fixture.js';
should();

for (const [name, fragment] of [
    ['inherited readiness', Object.create({ isReady: 'false' })],
    ['inherited authorization', Object.create({ isAuthorized: 'false' })],
    ['sparse warning members', { validationResults: [validation('warning', new Array<string>(1), 'rule', Severity.Warning)] }],
    ['sparse results', { validationResults: new Array(1) }],
    ['sparse messages', { exceptionMessages: new Array(1) }]
] as const) describe(`when query authorization returns ${name}`, () => {
    let application: FetchArcApplication;
    let result: QueryResult;
    const fixture = new query_filter_fixture();
    beforeEach(async () => {
        fixture.calls.length = 0;
        class Invalid { onPerform(): QueryResult { return fragment as QueryResult; } }
        const builder = fixture.builder;
        builder.services.addScoped(Invalid);
        builder.addAuthorizationQueryFilter(Invalid);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, fixture.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed before validation or the performer', () => {
        result.isSuccess.should.equal(false);
        result.hasExceptions.should.equal(true);
        fixture.calls.should.deep.equal([]);
    });
});

for (const [name, make] of [
    ['changing readiness', () => ({ get isReady() { return this.reads++ === 0 ? false : true; }, reads: 0 })],
    ['changing severity', () => ({ validationResults: [{ get severity() { return this.reads++ === 0 ? Severity.Error : NaN; },
        reads: 0, message: 'error', members: [], reason: 'rule' }] })]
] as const) describe(`when query authorization returns ${name}`, () => {
    let application: FetchArcApplication;
    let result: QueryResult;
    const fixture = new query_filter_fixture();
    beforeEach(async () => {
        fixture.calls.length = 0;
        const fragment = make();
        class Filter { onPerform(): QueryResult { return fragment as unknown as QueryResult; } }
        const builder = fixture.builder;
        builder.services.addScoped(Filter);
        builder.addAuthorizationQueryFilter(Filter);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, fixture.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should remain unsuccessful and never start the performer', () => {
        result.isSuccess.should.equal(false);
        fixture.calls.should.deep.equal([]);
    });
});
