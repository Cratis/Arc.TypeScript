// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import { defineQuery } from '../../queries/defineQuery.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { Severity } from '../../validation/Severity.js';
import { query_filter_fixture } from '../given/query_filter_fixture.js';
should();

const invalid: [string, object][] = [
    ['string authorization', { isAuthorized: 'false' }],
    ['numeric authorization', { isAuthorized: 0 }],
    ['null authorization', { isAuthorized: null }],
    ['null readiness', { isReady: null }],
    ['numeric readiness', { isReady: 0 }],
    ['string readiness', { isReady: 'false' }],
    ['NaN severity', { validationResults: [{ severity: NaN, message: 'rule', members: [], reason: 'rule' }] }],
    ['infinite severity', { validationResults: [{ severity: Infinity, message: 'rule', members: [], reason: 'rule' }] }],
    ['out-of-range severity', { validationResults: [{ severity: Severity.Error + 1, message: 'rule', members: [], reason: 'rule' }] }],
    ['invalid members', { validationResults: [{ severity: Severity.Error, message: 'rule', members: [42], reason: 'rule' }] }]
];

for (const [name, fragment] of invalid) {
    describe(`when query authorization returns ${name}`, () => {
        let application: FetchArcApplication;
        let result: QueryResult;
        const context = new query_filter_fixture();
        let later = 0;
        beforeEach(async () => {
            context.calls.length = 0;
            later = 0;
            class Invalid { onPerform(): QueryResult { return fragment as QueryResult; } }
            class Later { onPerform(): void { later++; } }
            const builder = context.builder;
            builder.services.addScoped(Invalid).addScoped(Later);
            builder.addAuthorizationQueryFilter(Invalid).addAuthorizationQueryFilter(Later)
                .addQueryPipelineFilter(context.pipeline);
            application = await builder.add(context.pipeline).build();
            result = await application.server.performQuery('FilteredQuery', { value: 'allowed' }, context.execution);
        });
        afterEach(async () => { await application.dispose(); });
        it('should fail closed instead of performing', () => {
            result.isSuccess.should.equal(false);
            result.hasExceptions.should.equal(true);
        });
        it('should not run later filters or validators or performer', () => {
            later.should.equal(0);
            context.calls.should.deep.equal([]);
        });
    });
}

describe('when malformed query authorization precedes validator dependencies', () => {
    let application: FetchArcApplication;
    let result: QueryResult;
    let constructed: number;
    let performed: number;
    beforeEach(async () => {
        constructed = 0;
        performed = 0;
        class Dependency {}
        class Invalid { onPerform(): QueryResult { return { isReady: 0 } as unknown as QueryResult; } }
        const builder = ArcApplication.createBuilder({ queries: [defineQuery({ name: 'Dependent',
            schema: z.object({}), authorization: { anonymous: true }, validatorDependencies: [Dependency],
            handlerDependencies: [Dependency], perform: () => { performed++; return 'visible'; }
        })] });
        builder.services.addScoped(Invalid).addScoped(Dependency, () => { constructed++; return new Dependency(); });
        builder.addAuthorizationQueryFilter(Invalid);
        application = await builder.build();
        result = await application.server.performQuery('Dependent', {}, {
            correlationId: 'invalid-dependency', principal: undefined, tenantId: undefined,
            allowedSeverity: Severity.Warning, signal: new AbortController().signal
        });
    });
    afterEach(async () => { await application.dispose(); });
    it('should fail before constructing validators or the performer', () => {
        result.isSuccess.should.equal(false);
        constructed.should.equal(0);
        performed.should.equal(0);
    });
});
