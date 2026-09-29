// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_discovered_chronicle_only_reactor } from './given/a_discovered_chronicle_only_reactor.js';

describe('when registering Chronicle after discovery with a Chronicle-only reactor discovered earlier and scoped activation',
    given(a_discovered_chronicle_only_reactor, context => {
        beforeEach(() => context.build(true));
        it('should claim the reactor and register its scoped fallback', () => { context.registered.should.equal(true); });
    }));
