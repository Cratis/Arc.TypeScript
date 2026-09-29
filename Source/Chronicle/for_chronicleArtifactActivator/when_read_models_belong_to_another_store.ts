// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { ActivatedReactor } from './given/artifacts.js';

describe('when read models belong to another store', given(an_activator, context => {
    let failure: Error;
    beforeEach(async () => {
        await context.build();
        try { await context.activate(ActivatedReactor, context.events(crypto.randomUUID(), context.store, {})); }
        catch (error) { failure = error as Error; }
    });
    afterEach(() => context.dispose());
    it('should reject the activation', () => { failure.message.should.contain('read models'); });
}));
