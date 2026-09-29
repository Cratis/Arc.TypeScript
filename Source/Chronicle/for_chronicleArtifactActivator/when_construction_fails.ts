// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { an_activator } from './given/an_activator.js';
import { disposals, ReactorThatCannotBeConstructed } from './given/artifacts.js';

const messages = (error: unknown): string[] => error instanceof AggregateError
    ? [error.message, ...error.errors.flatMap(messages)]
    : error instanceof Error ? [error.message, ...messages(error.cause)] : [];

describe('when construction fails', given(an_activator, context => {
    let failure: AggregateError;
    beforeEach(async () => {
        await context.build();
        try { await context.activate(ReactorThatCannotBeConstructed, context.events(crypto.randomUUID())); }
        catch (error) { failure = error as AggregateError; }
    });
    afterEach(() => context.dispose());
    it('should combine the failures', () => { failure.should.be.instanceOf(AggregateError); });
    it('should retain the construction failure', () => { messages(failure).join('\n').should.contain('construction failed'); });
    it('should retain the cleanup failure', () => { messages(failure).join('\n').should.contain('cleanup failed'); });
    it('should close the partially constructed services', () => { disposals.should.have.lengthOf(1); });
}));
