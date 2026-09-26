// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { a_reduced_command } from '../given/a_reduced_command.js';
import type { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';

describe('when executing with seeded events', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.check>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.check);
        scenario.given.forEventSource('source-a').events(new context.added(2), new context.added(3));
        scenario.given.forEventSource('source-b').events(new context.added(9));
        result = await scenario.execute({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should inject the reduced state for the selected source', () => {
        result.isSuccess.should.equal(true);
        result.shouldHaveAppendedEvent(context.checked, 'source-a', event => event.amount === 5);
    });
    it('should not report seed history as command-produced events', () => {
        result.appendedEvents.should.have.lengthOf(1);
        scenario.appendedEvents.should.have.lengthOf(1);
        (() => result.shouldHaveAppendedEvent(context.added)).should.throw('Expected ItemAdded');
    });
}));
