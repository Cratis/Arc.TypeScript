// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { disposals, SingletonReactor } from './given/artifacts.js';

describe('when activating a singleton artifact', given(an_activator, context => {
    let instances: SingletonReactor[];
    let disposedAfterDeliveries: string[];
    beforeEach(async () => {
        await context.build();
        instances = [];
        for (let batch = 0; batch < 2; batch++)
            await context.deliver(SingletonReactor, context.events(crypto.randomUUID()), async artifact => { instances.push(artifact.instance); });
        disposedAfterDeliveries = [...disposals];
        await context.dispose();
    });
    it('should reuse the container instance', () => { instances[0]!.should.equal(instances[1]); });
    it('should not dispose it with the lease', () => { disposedAfterDeliveries.should.have.lengthOf(0); });
    it('should dispose it with the container', () => { disposals.should.deep.equal(['singleton reactor']); });
}));
