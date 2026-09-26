// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import type { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';
import { a_reduced_command } from '../given/a_reduced_command.js';

describe('when executing with an unreduced read model and unrelated seeded events', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.unreduced>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.unreduced);
        scenario.given.forEventSource('source-a').events(new context.added(2));
        result = await scenario.execute({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should pass null to the command', () => {
        result.shouldBeSuccessful();
        (result.response as boolean).should.equal(true);
    });
}));
