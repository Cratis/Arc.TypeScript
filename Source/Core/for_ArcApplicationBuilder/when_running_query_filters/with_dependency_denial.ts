// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import type { QueryContext } from '../../queries/QueryContext.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { unauthorizedQueryResult } from '../../queries/unauthorizedQueryResult.js';
should();

describe('when a query admission filter denies a dependent performer', () => {
    let application: FetchArcApplication;
    let result: QueryResult;
    let constructed: number;
    let performed: number;
    beforeEach(async () => {
        constructed = 0;
        performed = 0;
        class Dependency {}
        class Deny { onPerform(query: QueryContext): QueryResult { return unauthorizedQueryResult(query); } }
        const builder = ArcApplication.createBuilder({ queries: [defineQuery({
            name: 'Dependent', schema: z.object({ value: z.string() }), authorization: { anonymous: true },
            validatorDependencies: [Dependency], handlerDependencies: [Dependency],
            perform: () => { performed++; return 'visible'; }
        })] });
        builder.services.addScoped(Dependency, () => { constructed++; return new Dependency(); }).addScoped(Deny);
        builder.addAuthorizationQueryFilter(Deny);
        application = await builder.build();
        result = await application.server.performQuery('Dependent', { value: 'denied' }, {
            correlationId: 'dependency-denial', principal: undefined, tenantId: undefined,
            signal: new AbortController().signal, allowedSeverity: 2
        });
    });
    afterEach(async () => { await application.dispose(); });
    it('should deny the query', () => { result.isAuthorized.should.equal(false); });
    it('should not construct validator or performer dependencies', () => { constructed.should.equal(0); });
    it('should not run the performer', () => { performed.should.equal(0); });
});
