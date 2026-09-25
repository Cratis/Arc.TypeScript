// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from '@cratis/arc.core';
import { given } from '../../given.js';
import { ChronicleReadModelForCommandResolver } from '../../ChronicleReadModelForCommandResolver.js';
import { a_projection } from '../../for_ChronicleReadModelInterceptor/given/a_projection.js';

describe('when injecting a Chronicle projection with personal data', given(a_projection, context => {
    let result: { name: string } | null;
    beforeEach(async () => {
        context.release.resetHistory();
        const resolver = new ChronicleReadModelForCommandResolver(context.runtime, context.artifacts);
        result = await resolver.find(context.model, '1', context.context as CommandContext);
    });
    it('should inject the kernel result unchanged', () => { (result === context.privateView).should.equal(true); });
    it('should use the tenant store for lookup', () => { context.getStore.calledWith(context.context).should.equal(true); });
    it('should not release it again', () => { context.release.called.should.equal(false); });
}));
