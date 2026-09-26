// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import { query_filter_fixture } from '../given/query_filter_fixture.js';
should();

describe('when registering a query filter twice', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        context.calls.length = 0;
        const builder = context.builder;
        builder.addAuthorizationQueryFilter(context.authorization).addAuthorizationQueryFilter(context.authorization);
        application = await builder.add(context.authorization).build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should still succeed', () => { result.isSuccess.should.equal(true); });
    it('should invoke the filter only once', () => {
        context.calls.should.deep.equal(['authorization', 'validate', 'perform']);
    });
}));

describe('when registering a query filter in both groups', given(query_filter_fixture, context => {
    let error: unknown;
    beforeEach(async () => {
        const builder = context.builder;
        builder.services.addScoped(context.authorization);
        builder.addAuthorizationQueryFilter(context.authorization).addQueryPipelineFilter(context.authorization);
        try { await builder.build(); } catch (failure) { error = failure; }
    });
    it('should refuse ambiguous registration', () => {
        (error as Error).message.should.contain('both groups');
    });
}));

describe('when registering a singleton query filter', given(query_filter_fixture, context => {
    let error: unknown;
    beforeEach(async () => {
        const builder = context.builder;
        builder.services.addSingleton(context.authorization);
        builder.addAuthorizationQueryFilter(context.authorization);
        try { await builder.build(); } catch (failure) { error = failure; }
    });
    it('should reject singleton lifetime', () => { (error as Error).message.should.contain('singleton'); });
}));
