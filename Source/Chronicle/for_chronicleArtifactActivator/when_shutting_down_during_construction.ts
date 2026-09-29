// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { construction, disposals, GatedReactor } from './given/artifacts.js';

describe('when shutting down during construction', given(an_activator, context => {
    const order: string[] = [];
    let settledBeforeRelease: boolean;
    beforeEach(async () => {
        await context.build();
        order.length = 0;
        let release!: () => void;
        construction.started = false;
        construction.gate = new Promise(resolve => { release = resolve; });
        const activation = context.activate(GatedReactor, context.events(crypto.randomUUID()));
        while (!construction.started) await new Promise(resolve => setTimeout(resolve, 1));
        let settled = false;
        const shutdown = context.dispose().then(() => { settled = true; order.push('shutdown settled'); });
        await new Promise(resolve => setTimeout(resolve, 10));
        settledBeforeRelease = settled;
        order.push('construction released');
        release();
        await activation.then(artifact => artifact.dispose?.(), () => undefined);
        order.push(...disposals);
        await shutdown;
    });
    it('should wait for the construction before settling shutdown', () => { settledBeforeRelease.should.equal(false); });
    it('should dispose the activation scope before shutdown settles', () => {
        order[0]!.should.equal('construction released');
        order[1]!.should.match(/^dependency /);
        order[order.length - 1]!.should.equal('shutdown settled');
    });
}));
