// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from '@cratis/arc.core';
import { given } from '../../given.js';
import { ChronicleReadModelForCommandResolver } from '../../ChronicleReadModelForCommandResolver.js';
import { a_projection } from '../../for_ChronicleReadModelInterceptor/given/a_projection.js';

describe('when injecting a reducer model already released by the SDK', given(a_projection, context => {
    let result: object | null;
    beforeEach(async () => {
        context.find.resolves(context.reducedView);
        result = await new ChronicleReadModelForCommandResolver(context.runtime, context.artifacts)
            .find(context.reducerModel, '1', context.context as CommandContext);
    });
    it('should not release it twice', () => { context.release.called.should.equal(false); });
    it('should inject the SDK result', () => { (result === context.reducedView).should.equal(true); });
}));
