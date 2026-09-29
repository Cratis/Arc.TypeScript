// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { ActivatedReactor } from './given/artifacts.js';

describe('when activating two batches', given(an_activator, context => {
    let instances: ActivatedReactor[];
    beforeEach(async () => {
        await context.build();
        instances = [];
        for (let batch = 0; batch < 2; batch++)
            await context.deliver(ActivatedReactor, context.events(crypto.randomUUID()), async artifact => { instances.push(artifact.instance); });
    });
    afterEach(() => context.dispose());
    it('should create an artifact per batch', () => { instances[0]!.should.not.equal(instances[1]); });
    it('should use a scope per batch', () => { instances[0]!.dependency.should.not.equal(instances[1]!.dependency); });
}));
