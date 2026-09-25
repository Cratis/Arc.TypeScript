// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_projection } from '../../given/a_projection.js';

describe('when serving a Chronicle observeAll emission', given(a_projection, context => {
    beforeEach(async () => {
        context.release.resetHistory();
        await context.observable(context.models().observeAll(context.model));
    });
    it('should not release the kernel result again', () => { context.release.called.should.equal(false); });
}));
