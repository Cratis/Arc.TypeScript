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
    it('should inject the released value', () => { result!.name.should.equal('plain'); });
    it('should use the tenant store for release', () => { context.getStore.calledWith(context.context).should.equal(true); });
    it('should release exactly once', () => { context.release.calledOnce.should.equal(true); });
}));
