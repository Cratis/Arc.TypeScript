// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '@cratis/arc.testing';
import type { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';
import { a_reduced_command } from '../given/a_reduced_command.js';

describe('when executing with a projection-backed read model', given(a_reduced_command, context => {
    let scenario: ChronicleCommandScenario<InstanceType<typeof context.projected>>;
    let result: Awaited<ReturnType<typeof scenario.execute>>;
    beforeEach(async () => {
        scenario = context.create(context.projected);
        scenario.given.forEventSource('source-a').events(new context.added(2));
        result = await scenario.execute({ id: 'source-a' });
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should identify the kernel scenario rather than quietly returning missing state', () => {
        result.isSuccess.should.equal(false);
        JSON.stringify(result).should.contain('ChronicleKernelScenario');
    });
}));
