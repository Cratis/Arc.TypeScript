// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from '@cratis/arc.core';
import { given } from '../../given.js';
import { ChronicleReadModelForCommandResolver } from '../../ChronicleReadModelForCommandResolver.js';
import { a_projection } from '../../given/a_projection.js';

describe('when injecting an absent Chronicle projection', given(a_projection, context => {
    let result: object | null;
    beforeEach(async () => {
        context.find.resolves(null);
        result = await new ChronicleReadModelForCommandResolver(context.runtime, context.artifacts)
            .find(context.model, 'missing', context.context as CommandContext);
    });
    it('should preserve null', () => { (result === null).should.equal(true); });
}));
