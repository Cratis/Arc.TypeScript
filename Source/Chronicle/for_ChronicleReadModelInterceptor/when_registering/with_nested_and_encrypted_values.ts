// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { hasProtectedReadModel } from '../../hasProtectedReadModel.js';
import { a_projection } from '../../given/a_projection.js';

describe('when detecting protected Chronicle read model types', given(a_projection, context => {
    let decisions: boolean[];
    beforeEach(() => {
        decisions = [context.nestedModel, context.arrayModel, context.classLevelModel, context.encryptedModel]
            .map(hasProtectedReadModel);
    });
    it('should find nested personal data', () => { decisions[0]!.should.equal(true); });
    it('should find personal data inside array items', () => { decisions[1]!.should.equal(true); });
    it('should find class-level personal data on a nested type', () => { decisions[2]!.should.equal(true); });
    it('should find encrypted security metadata', () => { decisions[3]!.should.equal(true); });
}));
