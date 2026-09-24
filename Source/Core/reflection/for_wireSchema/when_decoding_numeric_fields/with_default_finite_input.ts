// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { should } from 'vitest';
import { given } from '../../../given.js';
import { fieldOption } from '../../fieldOption.js';
import { objectSchema } from '../../wireSchema.js';
should();

class Amount {
    @field(Number) value!: number;
    @fieldOption({ namedFloats: true }) @field(Number) measured!: number;
}
class a_numeric_schema { readonly schema = objectSchema(Amount); }

describe('when decoding numeric fields with default finite input', given(a_numeric_schema, context => {
    it('should reject named floats for fields without explicit opt-in', () => {
        context.schema.safeParse({ value: 'NaN', measured: 'Infinity' }).success.should.equal(false);
    });
    it('should reject a nonfinite number even on an opted-in field', () => {
        context.schema.safeParse({ value: 1, measured: NaN }).success.should.equal(false);
    });
    it('should accept named floats only on the opted-in field', () => {
        context.schema.safeParse({ value: 1, measured: '-Infinity' }).success.should.equal(true);
    });
}));
