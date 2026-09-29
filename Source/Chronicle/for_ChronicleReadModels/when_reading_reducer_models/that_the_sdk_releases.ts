// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { sdk_reads, TopLevelReduced } from '../given/sdk_reads.js';

describe('when reading reducer models that the Chronicle SDK releases', given(sdk_reads, context => {
    it('should trust the result of findInstanceById', async () =>
        context.isReleased(TopLevelReduced, (await context.models.findInstanceById(TopLevelReduced, '1'))!).should.equal(true));
    it('should trust the result of getAll', async () =>
        context.isReleased(TopLevelReduced, (await context.models.getAll(TopLevelReduced))[0]!).should.equal(true));
    it('should trust a watched change', async () =>
        context.isReleased(TopLevelReduced, await context.watched(TopLevelReduced)).should.equal(true));
}));
