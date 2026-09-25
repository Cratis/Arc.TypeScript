// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { QueryContext } from '../../queries/QueryContext.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { queryFilterResult } from '../../queries/queryFilterResult.js';
import { unauthorizedQueryResult } from '../../queries/unauthorizedQueryResult.js';
import { validation } from '../../validation/ValidationResult.js';
import { Severity } from '../../validation/Severity.js';
import { query_filter_fixture } from '../given/query_filter_fixture.js';
should();

describe('when a query warning precedes authorization denial', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        context.calls.length = 0;
        class Warning { onPerform(query: QueryContext): QueryResult {
            context.calls.push('warning');
            return queryFilterResult(query, { validationResults: [validation('Warning', [], 'rule', Severity.Warning)] });
        } }
        class Deny { onPerform(query: QueryContext): QueryResult {
            context.calls.push('deny');
            return unauthorizedQueryResult(query);
        } }
        const builder = context.builder;
        builder.services.addScoped(Warning).addScoped(Deny);
        builder.addAuthorizationQueryFilter(Warning).addAuthorizationQueryFilter(Deny);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should continue to the later denial', () => { context.calls.should.deep.equal(['warning', 'deny']); });
    it('should return unauthorized without warning details', () => {
        result.isAuthorized.should.be.false;
        result.validationResults.should.be.empty;
    });
}));

describe('when an ordinary query filter returns a warning', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        context.calls.length = 0;
        class Warning { onPerform(query: QueryContext): QueryResult {
            context.calls.push('warning');
            return queryFilterResult(query, { validationResults: [validation('Warning', [], 'rule', Severity.Warning)] });
        } }
        const builder = context.builder;
        builder.services.addScoped(Warning);
        builder.addQueryPipelineFilter(Warning);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should continue through validation and the performer', () => {
        context.calls.should.deep.equal(['warning', 'validate', 'perform']);
        result.isSuccess.should.be.true;
    });
}));

describe('when a query filter returns an error above the allowed severity', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        context.calls.length = 0;
        class Block { onPerform(query: QueryContext): QueryResult {
            context.calls.push('block');
            return queryFilterResult(query, { validationResults: [validation('Blocked', [], 'rule', Severity.Error)] });
        } }
        class Later { onPerform(): void { context.calls.push('later'); } }
        const builder = context.builder;
        builder.services.addScoped(Block).addScoped(Later);
        builder.addAuthorizationQueryFilter(Block).addAuthorizationQueryFilter(Later);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should stop before the later filter', () => { context.calls.should.deep.equal(['block']); });
    it('should preserve the blocking error', () => { result.validationResults[0]!.message.should.equal('Blocked'); });
}));
