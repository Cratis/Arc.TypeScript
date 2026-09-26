// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import type { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';
import { a_reduced_command } from '../given/a_reduced_command.js';

describe('when executing with a required projection-backed model and no history', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.projected>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.projected);
        scenario.given.forEventSource('another-source').events(new context.added(2));
        result = await scenario.execute({ id: 'missing' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should report the model as not found', () => {
        result.shouldNotBeSuccessful();
        result.shouldHaveValidationErrorFor('ProjectedState was not found for the command key');
    });
}));

describe('when executing with an optional projection-backed model and no history', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.optionalProjected>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.optionalProjected);
        result = await scenario.execute({ id: 'missing' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should pass null to the command', () => {
        result.shouldBeSuccessful();
        (result.response as boolean).should.equal(true);
    });
}));
