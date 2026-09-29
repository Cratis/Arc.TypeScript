// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArtifactCompletionFailed } from '@cratis/chronicle/artifacts';
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { ReactorWithFailingCleanup } from './given/artifacts.js';

describe('when the handler and cleanup fail', given(an_activator, context => {
    const handlerFailure = new Error('handler failed');
    let failure: ArtifactCompletionFailed;
    beforeEach(async () => {
        await context.build();
        try {
            await context.deliver(ReactorWithFailingCleanup, context.events(crypto.randomUUID()), artifact =>
                artifact.run!(() => { throw handlerFailure; }, context.invocation()));
        } catch (error) { failure = error as ArtifactCompletionFailed; }
    });
    afterEach(() => context.dispose());
    it('should fail the delivery with the completion failure', () => { failure.should.be.instanceOf(ArtifactCompletionFailed); });
    it('should retain the handler failure', () => { (failure.processingError as Error).should.equal(handlerFailure); });
    it('should retain the cleanup failure', () => { (failure.completionError === undefined).should.equal(false); });
}));
