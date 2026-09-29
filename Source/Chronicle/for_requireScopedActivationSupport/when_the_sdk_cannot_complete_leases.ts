// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_sdk } from './given/an_sdk.js';

describe('when the SDK accepts the activator but cannot complete leases', given(an_sdk, context => {
    beforeEach(() => context.check(context.sdk(true, false)));
    it('should require Chronicle 6.17.0', () => {
        context.failure!.message.should.equal('activateArtifactsInScopes requires @cratis/chronicle 6.17.0 or later');
    });
}));
