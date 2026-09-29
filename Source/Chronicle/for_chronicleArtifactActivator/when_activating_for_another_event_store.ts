// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { ActivatedReactor, Dependency } from './given/artifacts.js';

describe('when activating for another event store', given(an_activator, context => {
    let failure: Error;
    let created: number;
    beforeEach(async () => {
        await context.build();
        created = Dependency.created;
        try { await context.activate(ActivatedReactor, context.events(crypto.randomUUID(), 'Other')); }
        catch (error) { failure = error as Error; }
    });
    afterEach(() => context.dispose());
    it('should reject the activation', () => { failure.message.should.contain('Other'); });
    it('should not resolve any services', () => { Dependency.created.should.equal(created); });
}));
