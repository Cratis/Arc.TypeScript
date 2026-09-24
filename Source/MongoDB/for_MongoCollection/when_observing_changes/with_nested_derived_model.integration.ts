// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import type { Document, Filter } from 'mongodb';
import { derivedType, field, Guid } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';
import { MongoDocumentCodec } from '../../MongoDocumentCodec.js';
import { given } from '../../given.js';
import { a_replica_set } from '../given/a_replica_set.js';

should();
class Shape { @field(String) kind!: string; }
@derivedType('circle')
class Circle extends Shape { @field(Number) radius!: number; }
class Drawing { @field(Guid) @key() id!: Guid; @field(Shape) shape!: Shape; }

describe('when persisting a nested derived model in a replica set', given(a_replica_set, context => {
    it('should restore the nested subtype from BSON', async () => {
        await context.client.connect();
        const database = context.client.db(context.name);
        try {
            const codec = new MongoDocumentCodec(Drawing);
            const model = Object.assign(new Drawing(), {
                id: Guid.parse('00112233-4455-6677-8899-aabbccddeeff'),
                shape: Object.assign(new Circle(), { kind: 'round', radius: 4 })
            });
            const collection = database.collection('Drawings');
            await collection.insertOne(codec.serialize(model));
            const stored = await collection.findOne({ _id: codec.id(model.id) } as Filter<Document>);
            const restored = codec.deserialize(stored!);
            restored.shape.should.be.instanceOf(Circle);
            (restored.shape as Circle).radius.should.equal(4);
        } finally {
            try { await database.dropDatabase(); } finally { await context.client.close(); }
        }
    }, 30000);
}));
