// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { derivedType, field, Guid } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';
import { MongoDocumentCodec } from '../MongoDocumentCodec.js';

should();
class Shape { @field(String) kind!: string; }
@derivedType('circle')
class Circle extends Shape { @field(Number) radius!: number; }
class Drawing {
    @field(Guid) @key() id!: Guid;
    @field(Shape) shape!: Shape;
    @field(Array, { genericArguments: [Shape] }) shapes!: Shape[];
}

describe('when round tripping nested derived values', () => {
    it('should preserve runtime fields and discriminator for scalar and array elements', () => {
        const circle = Object.assign(new Circle(), { kind: 'round', radius: 4 });
        const model = Object.assign(new Drawing(), {
            id: Guid.parse('00112233-4455-6677-8899-aabbccddeeff'), shape: circle, shapes: [circle]
        });
        const codec = new MongoDocumentCodec(Drawing);
        const document = codec.serialize(model);
        document.shape.should.deep.equal({ kind: 'round', radius: 4, _derivedTypeId: 'circle' });
        document.shapes[0].should.deep.equal(document.shape);
        const restored = codec.deserialize(document);
        restored.shape.should.be.instanceOf(Circle);
        (restored.shape as Circle).radius.should.equal(4);
        restored.shapes[0]!.should.be.instanceOf(Circle);
    });
});
