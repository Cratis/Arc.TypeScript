// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { ActivatedReactor, disposals } from './given/artifacts.js';

describe('when activating after shutdown without earlier activations', given(an_activator, context => {
    let failure: Error | undefined;
    beforeEach(async () => {
        await context.build();
        await context.dispose();
        failure = undefined;
        try { await context.activate(ActivatedReactor, context.events(crypto.randomUUID())); }
        catch (error) { failure = error as Error; }
    });
    it('should reject the activation', () => { (failure instanceof Error).should.equal(true); });
    it('should not create services for it', () => { disposals.should.have.lengthOf(0); });
}));
