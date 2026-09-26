// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import type { QueryContext } from '../../queries/QueryContext.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { unauthorizedQueryResult } from '../../queries/unauthorizedQueryResult.js';
import { validation } from '../../validation/ValidationResult.js';
import { query_filter_fixture } from '../given/query_filter_fixture.js';
should();

describe('when a later query admission filter denies', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        context.calls.length = 0;
        class Deny { onPerform(query: QueryContext): QueryResult { return unauthorizedQueryResult(query); } }
        const builder = context.builder;
        builder.services.addScoped(Deny);
        builder.addAuthorizationQueryFilter(context.authorization).addAuthorizationQueryFilter(Deny);
        application = await builder.add(context.authorization).build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should deny without a reason field', () => { result.isAuthorized.should.equal(false); });
    it('should run the first filter once', () => { context.calls.should.deep.equal(['authorization']); });
}));

describe('when a query denial carries validation details', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        class Deny {
            onPerform(query: QueryContext): QueryResult {
                return { ...unauthorizedQueryResult(query), validationResults: [validation('Private')] };
            }
        }
        const builder = context.builder;
        builder.services.addScoped(Deny);
        builder.addAuthorizationQueryFilter(Deny);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should clear the validation details', () => { result.validationResults.should.have.lengthOf(0); });
}));

describe('when a query filter supplies only a partial fragment', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        class Partial { onPerform(): QueryResult { return {} as QueryResult; } }
        const builder = context.builder;
        builder.services.addScoped(Partial);
        builder.addAuthorizationQueryFilter(Partial);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should treat missing authorization as allowed', () => { result.isAuthorized.should.equal(true); });
    it('should keep missing validation arrays empty', () => { result.validationResults.should.have.lengthOf(0); });
}));

describe('when a query filter returns malformed validation data', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        class Invalid { onPerform(): QueryResult { return { validationResults: null } as unknown as QueryResult; } }
        const builder = context.builder;
        builder.services.addScoped(Invalid);
        builder.addAuthorizationQueryFilter(Invalid);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed with an exception', () => { result.hasExceptions.should.equal(true); });
}));

describe('when an asynchronous query admission filter rejects', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        class Reject { async onPerform(): Promise<void> { throw new Error('Admission failed'); } }
        const builder = context.builder;
        builder.services.addScoped(Reject);
        builder.addAuthorizationQueryFilter(Reject);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed with an exception', () => { result.hasExceptions.should.equal(true); });
}));

describe('when a query filter factory fails at runtime', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        class FactoryFilter { onPerform(): void {} }
        const builder = context.builder;
        builder.services.addScoped(FactoryFilter, () => { throw new Error('Factory failed'); });
        builder.addAuthorizationQueryFilter(FactoryFilter);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed with an exception', () => { result.hasExceptions.should.equal(true); });
}));

describe('when a query pipeline filter throws', given(query_filter_fixture, context => {
    let application: FetchArcApplication;
    let result: QueryResult;
    beforeEach(async () => {
        class Throwing { onPerform(): void { throw new Error('Pipeline failed'); } }
        const builder = context.builder;
        builder.services.addScoped(Throwing);
        builder.addQueryPipelineFilter(Throwing);
        application = await builder.build();
        result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail closed with an exception', () => { result.hasExceptions.should.equal(true); });
}));
