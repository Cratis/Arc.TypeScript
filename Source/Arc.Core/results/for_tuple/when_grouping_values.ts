// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { tuple } from '../tuple.js';
import { isArcTuple, type ArcTuple } from '../ArcTuple.js';
import { encode } from '../../reflection/wireSchema.js';

describe('when grouping several return values', () => {
    let result: ArcTuple<readonly [string, number]>;
    beforeEach(() => { result = tuple('value', 2); });
    it('should carry a distinct tuple brand', () => { isArcTuple(result).should.equal(true); });
    it('should serialize to the existing response array', () => { (encode(result) as unknown[]).should.deep.equal(['value', 2]); });
});
