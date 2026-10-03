// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { an_event_source_aware_store, DepositRepeatingLegacy } from '../../given/event_source_routing.js';

describe('when a command repeats its definition in string routing', given(an_event_source_aware_store, setup => {
    it('should build', async () => { await (await setup.build(DepositRepeatingLegacy)).dispose(); });
}));
