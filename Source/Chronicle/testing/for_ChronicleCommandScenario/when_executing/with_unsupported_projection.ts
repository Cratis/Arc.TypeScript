// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import { UnsupportedProjectionOperation } from '@cratis/chronicle/testing';
import type { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';
import { a_reduced_command } from '../given/a_reduced_command.js';

describe('when executing with an unsupported projection', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.unsupported>>;
    let failure: unknown;
    beforeEach(async () => {
        scenario = context.create(context.unsupported);
        scenario.given.forEventSource('source-a').events(new context.added(2));
        try { await scenario.execute({ id: 'source-a' }); } catch (error) { failure = error; }
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should propagate the SDK error type with its kernel guidance', () => {
        (failure instanceof UnsupportedProjectionOperation).should.equal(true);
        (failure as Error).message.should.contain('kernel-backed test');
    });
}));
