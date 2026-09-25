// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { query_filter_fixture } from '../given/query_filter_fixture.js';
should();

describe('when query authorization denies invalid input', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        context.calls.length = 0;
        application = await context.builder.add(context.pipeline, context.authorization).build();
        result = await application.server.performQuery('FilteredQuery', { value: 'denied' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should deny', () => { result.isAuthorized.should.equal(false); });
    it('should disclose no validation results', () => { result.validationResults.should.have.lengthOf(0); });
    it('should run authorization before the validator and performer', () => {
        context.calls.should.deep.equal(['authorization']);
    });
}));

describe('when query authorization allows malformed input', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        context.calls.length = 0;
        application = await context.builder.add(context.authorization, context.pipeline).build();
        result = await application.server.performQuery('FilteredQuery', { value: 42 }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should reject malformed input', () => { result.validationResults[0]!.reason.should.equal('malformedRequest'); });
    it('should not run validators or ordinary filters', () => { context.calls.should.deep.equal(['authorization']); });
}));

describe('when query authorization allows valid input', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        context.calls.length = 0;
        application = await context.builder.add(context.pipeline, context.authorization).build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should return the result', () => { result.should.have.property('data').deep.equal({ value: 'allowed' }); });
    it('should run each stage once in order', () => {
        context.calls.should.deep.equal(['authorization', 'pipeline', 'validate', 'perform']);
    });
}));
