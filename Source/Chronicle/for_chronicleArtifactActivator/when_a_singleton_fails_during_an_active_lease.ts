// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { FailingSingleton, ScopedReactor } from './given/artifacts.js';

describe('when a singleton fails during an active lease', given(an_activator, context => {
    let failure: Error;
    let shutdownSettled: boolean;
    beforeEach(async () => {
        await context.build();
        const artifact = await context.activate(ScopedReactor, context.events(crypto.randomUUID()));
        try { await artifact.run!(() => artifact.instance.scope.resolve(FailingSingleton)); }
        catch (error) { failure = error as Error; }
        let settled = false;
        const shutdown = context.dispose().then(() => { settled = true; });
        await artifact.complete!();
        await Promise.race([shutdown, new Promise(resolve => setTimeout(resolve, 1000))]);
        shutdownSettled = settled;
    });
    it('should fail the handler', () => { failure.message.should.contain('FailingSingleton'); });
    it('should still complete shutdown', () => { shutdownSettled.should.equal(true); });
}));
