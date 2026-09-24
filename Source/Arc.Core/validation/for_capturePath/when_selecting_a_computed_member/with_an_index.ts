// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { capturePath } from '../../capturePath.js';

describe('when selecting a computed member with an index', () => {
    let failure: unknown;
    beforeEach(() => {
        try { capturePath((model: { values: string[] }) => model.values[0]); } catch (error) { failure = error; }
    });
    it('should reject an indexed selector', () => { (failure as Error).message.should.equal('Validation selectors require direct property access'); });
});
