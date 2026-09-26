// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import type { QueryContext } from '../../queries/QueryContext.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import { queryFilterResult } from '../../queries/queryFilterResult.js';
import { unauthorizedQueryResult } from '../../queries/unauthorizedQueryResult.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { validation } from '../../validation/ValidationResult.js';
import { Severity } from '../../validation/Severity.js';
should();

describe('when a warning precedes denial at observable query admission', () => {
    let application: FetchArcApplication;
    let result: QueryResult;
    let calls: string[];
    beforeEach(async () => {
        calls = [];
        class Warning { onPerform(query: QueryContext): QueryResult {
            calls.push('warning');
            return queryFilterResult(query, { validationResults: [validation('Warning', [], 'rule', Severity.Warning)] });
        } }
        class Deny { onPerform(query: QueryContext): QueryResult {
            calls.push('deny');
            return unauthorizedQueryResult(query);
        } }
        const builder = ArcApplication.createBuilder({ observableQueries: [defineObservableQuery({
            name: 'Live', schema: z.object({}), authorization: { anonymous: true },
            observe: () => { calls.push('observe'); return CurrentValueSubject.of('visible'); }
        })] });
        builder.services.addScoped(Warning).addScoped(Deny);
        builder.addAuthorizationQueryFilter(Warning).addAuthorizationQueryFilter(Deny);
        application = await builder.build();
        result = await application.server.performQuery('Live', {}, { correlationId: 'live', principal: undefined,
            tenantId: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning });
    });
    afterEach(async () => { await application.dispose(); });
    it('should run the later denial without opening the producer', () => {
        calls.should.deep.equal(['warning', 'deny']);
        result.isAuthorized.should.equal(false);
    });
    it('should not disclose the filtered warning', () => { result.validationResults.should.have.lengthOf(0); });
});
