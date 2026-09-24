// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { decode, encode, objectSchema } from '../../wireSchema.js';
import { stringifyWire } from '../../stringifyWire.js';
import { HttpMetric } from '../given/HttpMetric.js';
should();

describe('when round tripping numeric fields with named floats and acronyms', () => {
    let value: HttpMetric;
    beforeEach(() => {
        value = decode(HttpMetric, objectSchema(HttpMetric).parse({ HTTPCount: 'Infinity', recordedValue: 'NaN' })) as HttpMetric;
    });
    it('should materialize named floating point values', () => {
        value.HTTPCount.should.equal(Infinity);
        Number.isNaN(value.RecordedValue).should.equal(true);
    });
    it('should keep leading acronyms and camel case ordinary names on output', () => {
        JSON.parse(stringifyWire(encode(value))).should.deep.equal({ HTTPCount: 'Infinity', recordedValue: 'NaN' });
    });
});
