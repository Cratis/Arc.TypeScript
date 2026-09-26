// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../given.js';
import { a_gated_observation, flush } from './given/a_gated_observation.js';

describe('when closing an observation before a scheduled reread starts', given(a_gated_observation, context => {
    let emissions: number[];
    beforeEach(async () => {
        context.reads = 0;
        emissions = [];
        const observation = context.open(() => Promise.resolve(context.reads));
        observation.subscribe(value => emissions.push(value));
        await flush();
        context.notify();
        observation.close();
        await flush();
    });
    afterEach(() => context.close());
    it('should not start another read', () => { context.reads.should.equal(1); });
    it('should not emit after closing', () => { emissions.should.deep.equal([1]); });
    it('should release the listener', () => { context.listeners.should.equal(0); });
}));
