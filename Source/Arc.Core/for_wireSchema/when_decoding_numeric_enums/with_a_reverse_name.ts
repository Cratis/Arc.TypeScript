// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { objectSchema } from '../../modelBound/reflection/wireSchema.js';
import { NumericMessage } from '../given/NumericMessage.js';

describe('when decoding a numeric enum reverse name', () => {
    let accepted: boolean;
    beforeEach(() => { accepted = objectSchema(NumericMessage).safeParse({ priority: 'High' }).success; });
    it('should reject the string name rather than returning a string for a number', () => { accepted.should.equal(false); });
});
