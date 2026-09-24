// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { decode, encode, schemaFor } from '../../wireSchema.js';
import { MessageBase } from '../given/MessageBase.js';
import { TextMessage } from '../given/TextMessage.js';
import '../given/NumberMessage.js';
should();

describe('when decoding a registered derivative', () => {
    let result: unknown;
    beforeEach(() => {
        const value = { title: 'hello', text: 'world', _derivedTypeId: 'text' };
        result = decode(MessageBase, schemaFor(MessageBase).parse(value));
    });
    it('should materialize the concrete type with its inherited fields', () => {
        (result as TextMessage).should.be.instanceOf(TextMessage);
        (result as TextMessage).title.should.equal('hello');
        (result as TextMessage).text.should.equal('world');
    });
    it('should encode the discriminator after its fields', () => {
        (encode(result, MessageBase) as object).should.deep.equal({ title: 'hello', text: 'world', _derivedTypeId: 'text' });
    });
    it('should expose the derivatives as oneOf in input JSON Schema', () => {
        const schema = z.toJSONSchema(schemaFor(MessageBase));
        (schema.oneOf as unknown[]).should.have.lengthOf(2);
    });
});

describe('when decoding an unknown derivative', () => {
    it('should reject its discriminator', () => {
        (() => schemaFor(MessageBase).parse({ title: 'hello', _derivedTypeId: 'unknown' })).should.throw();
    });
});
