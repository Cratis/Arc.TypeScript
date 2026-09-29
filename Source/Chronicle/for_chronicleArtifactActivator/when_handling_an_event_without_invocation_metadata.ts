// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { ActivatedReactor } from './given/artifacts.js';

describe('when handling an event without invocation metadata', given(an_activator, context => {
    let handled: boolean;
    let failure: Error | undefined;
    beforeEach(async () => {
        await context.build();
        handled = false;
        failure = undefined;
        try {
            // Chronicle 6.16 runs handlers without invocation metadata.
            await context.deliver(ActivatedReactor, context.events(crypto.randomUUID()), async artifact => {
                await artifact.run!(() => { handled = true; });
            });
        } catch (error) { failure = error as Error; }
    });
    afterEach(() => context.dispose());
    it('should not run the handler', () => { handled.should.equal(false); });
    it('should fail the delivery naming the minimum SDK', () => { failure!.message.should.contain('requires @cratis/chronicle 6.17.0 or later'); });
}));
