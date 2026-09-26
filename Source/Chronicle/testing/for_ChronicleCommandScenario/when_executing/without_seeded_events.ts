// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import type { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';
import { a_reduced_command } from '../given/a_reduced_command.js';

describe('when executing without seeded events', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.check>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.check);
        result = await scenario.execute({ id: 'missing' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should reject a missing required read model as in production', () => {
        result.shouldNotBeSuccessful();
        result.shouldHaveValidationErrorFor('ItemState was not found for the command key');
        result.appendedEvents.should.have.lengthOf(0);
    });
}));

describe('when executing with an optional missing read model', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.optional>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.optional);
        result = await scenario.execute({ id: 'missing' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should pass null to the command', () => {
        result.isSuccess.should.equal(true);
        (result.response as boolean).should.equal(true);
    });
}));
