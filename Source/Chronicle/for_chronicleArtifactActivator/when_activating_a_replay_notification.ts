// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArtifactDelivery } from '@cratis/chronicle/artifacts';
import type { ArtifactInvocationContext } from '@cratis/chronicle/artifacts';
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { ActivatedReactor } from './given/artifacts.js';

describe('when activating a replay notification', given(an_activator, context => {
    const eventCorrelation = crypto.randomUUID();
    let batch: ActivatedReactor;
    let notified: ActivatedReactor;
    let correlation: string;
    beforeEach(async () => {
        await context.build();
        await context.deliver(ActivatedReactor, context.events(eventCorrelation), async artifact => { batch = artifact.instance; });
        await context.deliver(ActivatedReactor, context.replayNotification(), async artifact => {
            notified = artifact.instance;
            correlation = await artifact.run!(() => artifact.instance.observed().correlation,
                { delivery: ArtifactDelivery.ReplayNotification, replayState: {} } as unknown as ArtifactInvocationContext);
        });
    });
    afterEach(() => context.dispose());
    it('should use a separate scope', () => { notified.dependency.should.not.equal(batch.dependency); });
    it('should generate its own correlation', () => { correlation.should.not.equal(eventCorrelation); });
    it('should generate a valid correlation', () => { correlation.should.match(/^[0-9a-f-]{36}$/); });
}));
