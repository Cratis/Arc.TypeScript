// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import type { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';
import { a_reduced_command } from '../given/a_reduced_command.js';

describe('when validating against seeded history', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.validated>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.validated);
        scenario.given.forEventSource('source-a').events(new context.added(3));
        result = await scenario.execute({ id: 'source-a', count: 3 });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should supply reduced state to readModelForValidation', () => {
        result.isSuccess.should.equal(true);
    });
}));

describe('when providing state from seeded history', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.validate>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.validate);
        scenario.given.forEventSource('source-a').events(new context.added(3));
        result = await scenario.execute({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should pass the reduced read model into provide', () => {
        result.isSuccess.should.equal(true);
        (result.response as boolean).should.equal(true);
    });
}));
