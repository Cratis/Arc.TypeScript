// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '@cratis/arc.core';
import { CommandScenario } from '../../index.js';

@command({ namespace: 'One' })
class Repeated { handle(): string { return 'first'; } }
@command({ namespace: 'Two' })
class Other { handle(): string { return 'second'; } }
Object.defineProperty(Other, 'name', { value: 'Repeated' });

describe('when executing a command with the same class name as another registered artifact', () => {
    let scenario: CommandScenario<Repeated>;
    let failure: unknown;
    beforeEach(async () => {
        scenario = CommandScenario.for(Repeated, Other);
        try { await scenario.execute(new Repeated()); } catch (error) { failure = error; }
    });
    afterEach(async () => { await scenario.dispose(); });
    it('should reject ambiguous command names rather than pick the first', () => {
        (failure as Error).message.should.contain('Ambiguous');
    });
});
