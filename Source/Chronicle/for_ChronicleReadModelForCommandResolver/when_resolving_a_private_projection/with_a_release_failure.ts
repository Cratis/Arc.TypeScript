// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from '@cratis/arc.core';
import { given } from '../../given.js';
import { ChronicleReadModelForCommandResolver } from '../../ChronicleReadModelForCommandResolver.js';
import { a_projection } from '../../for_ChronicleReadModelInterceptor/given/a_projection.js';

describe('when injecting a projection while release is unavailable', given(a_projection, context => {
    let result: object | null;
    beforeEach(async () => {
        context.release.resetHistory();
        context.release.rejects(new Error('kernel rejected release'));
        result = await new ChronicleReadModelForCommandResolver(context.runtime, context.artifacts)
            .find(context.model, '1', context.context as CommandContext);
    });
    it('should inject the already released kernel result', () => { (result === context.privateView).should.equal(true); });
    it('should not call release', () => { context.release.called.should.equal(false); });
}));
