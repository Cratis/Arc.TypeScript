// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { currentContext } from '@cratis/arc.core';
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { ActivatedReactor, disposals } from './given/artifacts.js';

describe('when shutting down with an active activation', given(an_activator, context => {
    const order: string[] = [];
    let signalAborted: boolean;
    let rejected: Error;
    beforeEach(async () => {
        await context.build();
        order.length = 0;
        const artifact = await context.activate(ActivatedReactor, context.events(crypto.randomUUID()));
        const signal = await artifact.run!(() => currentContext()!.signal);
        const shutdown = context.dispose().then(() => { order.push('shutdown settled'); });
        await new Promise(resolve => setTimeout(resolve, 10));
        signalAborted = signal.aborted;
        try { await context.activate(ActivatedReactor, context.events(crypto.randomUUID())); }
        catch (error) { rejected = error as Error; }
        order.push('lease completing');
        await artifact.complete!();
        order.push(...disposals);
        await shutdown;
    });
    it('should cancel the active activation', () => { signalAborted.should.be.true; });
    it('should reject new activations', () => { rejected.message.should.contain('stopped'); });
    it('should wait for the active lease before settling shutdown', () => { order[0]!.should.equal('lease completing'); });
    it('should dispose the activation scope before shutdown settles', () => {
        order.should.have.lengthOf(3);
        order[1]!.should.match(/^dependency /);
        order[2]!.should.equal('shutdown settled');
    });
}));
