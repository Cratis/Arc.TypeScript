// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer, defineQuery, ServiceLifetime, serviceToken, SortDirection, type ReadModelInterceptor } from '@cratis/arc.core';
import { Decimal128, ObjectId } from 'mongodb';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { a_typed_tenant_collection, Person } from '../given/a_typed_tenant_collection.js';
import { executionContext } from '../given/a_tenant_collection.js';

should();
describe.each(['identifier', 'amount'])('when sorting raw documents by a BSON scalar field %s', field => {
    let result: Awaited<ReturnType<ArcServer['performQuery']>>;
    let intercepted: string[];
    beforeEach(async () => {
        const context = new a_typed_tenant_collection();
        context.toArray.resolves([
            { ...context.doc, _id: 'second', identifier: new ObjectId('bbbbbbbbbbbbbbbbbbbbbbbb'), amount: Decimal128.fromString('2.5') },
            { ...context.doc, _id: 'first', identifier: new ObjectId('aaaaaaaaaaaaaaaaaaaaaaaa'), amount: Decimal128.fromString('1.5') }
        ]);
        intercepted = [];
        const token = serviceToken<ReadModelInterceptor>('raw BSON scalar interceptor');
        const server = new ArcServer({
            introspection: { enabled: false },
            services: [{ token, lifetime: ServiceLifetime.Scoped, factory: (): ReadModelInterceptor => ({
                model: Person,
                intercept: model => model,
                interceptRawDocument: (document, provenance) => { intercepted.push(provenance.subject); return document; }
            }) }],
            readModelInterceptors: [token],
            queries: [defineQuery({ name: 'People', schema: z.object({}),
                perform: (_, execution) => context.typed.find(execution, 'alice') })]
        });
        try {
            result = await server.performQuery('People', {}, executionContext('tenant-a'), {
                sorting: { field, direction: SortDirection.Ascending }
            });
        } finally { await server.dispose(); await context.client.close(); }
    });
    it('should preserve raw BSON string comparison before interception', () => {
        result.isSuccess.should.equal(true);
        (result.data as { _id: string }[]).map(row => row._id).should.deep.equal(['first', 'second']);
        intercepted.should.deep.equal(['first', 'second']);
    });
});
