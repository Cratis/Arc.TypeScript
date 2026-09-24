// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { decode, encode, objectSchema } from '../../wireSchema.js';
import { given } from '../../../given.js';
import { a_temporal_message } from '../given/a_temporal_message.js';

describe('when decoding and encoding temporal fields', given(a_temporal_message, context => {
    let result: Record<string, unknown>;
    beforeEach(() => { result = encode(decode(context.type, objectSchema(context.type).parse(context.fields))) as Record<string, unknown>; });
    it('should preserve the wire representation of each temporal type', () => {
        result.should.deep.equal(context.fields);
    });
}));
