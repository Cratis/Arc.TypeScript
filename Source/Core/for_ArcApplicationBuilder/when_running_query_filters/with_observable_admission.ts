// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { afterEach, beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcApplication } from '../../ArcApplication.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import type { QueryContext } from '../../queries/QueryContext.js';
import type { QueryResult } from '../../queries/QueryResult.js';
import { unauthorizedQueryResult } from '../../queries/unauthorizedQueryResult.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { HubFrameType } from '../../queries/observable/HubFrameType.js';
import { HubSubscriptionOutcome } from '../../queries/observable/HubSubscriptionOutcome.js';
import { a_query_connection } from '../../queries/observable/for_HubConnection/given/a_query_connection.js';
should();

describe('when admitting an observable query in a hub', () => {
    let connection: a_query_connection;
    let application: FetchArcApplication;
    let outcome: HubSubscriptionOutcome;
    let calls: number;
    let names: (string | undefined)[];
    let observations: number;
    beforeEach(async () => {
        calls = 0;
        names = [];
        observations = 0;
        class Deny {
            onPerform(context: QueryContext): QueryResult {
                calls++;
                names.push(context.operationName);
                return unauthorizedQueryResult(context);
            }
        }
        const builder = ArcApplication.createBuilder({ observableQueries: [defineObservableQuery({
            name: 'LiveFiltered', schema: z.object({}), authorization: { anonymous: true },
            observe: () => { observations++; return CurrentValueSubject.of('visible'); }
        })] });
        builder.services.addScoped(Deny);
        builder.addAuthorizationQueryFilter(Deny);
        application = await builder.build();
        connection = new a_query_connection(application.server);
        outcome = await connection.connection.subscribe('first', 1, { queryName: 'LiveFiltered' });
    });
    afterEach(async () => { await connection.close(); await application.dispose(); });
    it('should deny the subscription', () => { outcome.should.equal(HubSubscriptionOutcome.Unauthorized); });
    it('should send an Unauthorized frame', () => {
        connection.frames.some(frame => frame.type === HubFrameType.Unauthorized).should.equal(true);
    });
    it('should run admission once at subscribe', () => { calls.should.equal(1); });
    it('should identify the observable operation at admission', () => {
        names.should.deep.equal(['LiveFiltered']);
        application.server.queries[0]!.fullyQualifiedName.should.equal(names[0]);
    });
    it('should not construct the source', () => { observations.should.equal(0); });
});

describe('when observing accepted emissions', () => {
    let application: FetchArcApplication;
    let calls: number;
    let source: CurrentValueSubject<string>;
    beforeEach(async () => {
        calls = 0;
        source = CurrentValueSubject.of('initial');
        class Allow { onPerform(): void { calls++; } }
        const builder = ArcApplication.createBuilder({ observableQueries: [defineObservableQuery({
            name: 'LiveFiltered', schema: z.object({}), authorization: { anonymous: true }, observe: () => source
        })] });
        builder.services.addScoped(Allow);
        builder.addAuthorizationQueryFilter(Allow);
        application = await builder.build();
        const session = await application.server.openObservableQuery('LiveFiltered', {}, { correlationId: 'live',
            principal: undefined, tenantId: undefined, signal: new AbortController().signal, allowedSeverity: 2 });
        await session.current();
        source.next('later');
        await session.current();
        await session.close();
    });
    afterEach(async () => { await application.dispose(); });
    it('should run the filter only at subscription admission', () => { calls.should.equal(1); });
});
