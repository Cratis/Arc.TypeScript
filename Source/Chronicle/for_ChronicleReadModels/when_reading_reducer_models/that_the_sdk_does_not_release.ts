// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Constructor } from '@cratis/fundamentals';
import { given } from '../../given.js';
import { EncryptedReduced, NestedReduced, sdk_reads } from '../given/sdk_reads.js';

describe('when reading reducer models that the Chronicle SDK does not release', given(sdk_reads, context => {
    for (const type of [NestedReduced, EncryptedReduced] as Constructor<object>[]) {
        it(`should not trust ${type.name} from findInstanceById`, async () =>
            context.isReleased(type, (await context.models.findInstanceById(type, '1'))!).should.equal(false));
        it(`should not trust ${type.name} from getAll`, async () =>
            context.isReleased(type, (await context.models.getAll(type))[0]!).should.equal(false));
        it(`should not trust ${type.name} from watch`, async () =>
            context.isReleased(type, await context.watched(type)).should.equal(false));
    }
}));
