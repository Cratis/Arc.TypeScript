// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArtifactCompletionFailed } from '@cratis/chronicle/artifacts';
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { ReactorWithFailingCleanup } from './given/artifacts.js';

describe('when cleanup fails', given(an_activator, context => {
    let failure: ArtifactCompletionFailed;
    beforeEach(async () => {
        await context.build();
        try { await context.deliver(ReactorWithFailingCleanup, context.events(crypto.randomUUID()), async () => {}); }
        catch (error) { failure = error as ArtifactCompletionFailed; }
    });
    afterEach(() => context.dispose());
    it('should fail the delivery', () => { failure.should.be.instanceOf(ArtifactCompletionFailed); });
    it('should report the cleanup failure', () => { String(failure.completionError).should.not.equal('undefined'); });
    it('should not report a processing failure', () => { (failure.processingError === undefined).should.equal(true); });
}));
