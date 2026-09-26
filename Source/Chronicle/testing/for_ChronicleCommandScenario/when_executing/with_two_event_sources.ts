// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import type { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';
import { a_reduced_command } from '../given/a_reduced_command.js';

describe('when executing with two seeded event sources', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.check>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.check);
        scenario.given.forEventSource('source-a').events(new context.added(2));
        scenario.given.forEventSource('source-b').events(new context.added(9));
        result = await scenario.execute({ id: 'source-b' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should use only the history belonging to the requested source', () => {
        result.isSuccess.should.equal(true);
        result.shouldHaveAppendedEvent(context.checked, 'source-b', event => event.amount === 9);
    });
}));
