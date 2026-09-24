// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '@cratis/arc.core';
import { CommandScenario } from '../../index.js';

@command()
class ProduceNonJsonValue {
    handle(): { value: number } { return { value: Number.NaN }; }
}

describe('when executing a command with JSON round trips disabled', () => {
    let scenario: CommandScenario<ProduceNonJsonValue>;
    let defaultScenario: CommandScenario<ProduceNonJsonValue>;
    let value: number;
    let defaultValue: number | null;
    beforeEach(async () => {
        scenario = CommandScenario.for(ProduceNonJsonValue).withSerializationRoundTrip(false);
        defaultScenario = CommandScenario.for(ProduceNonJsonValue);
        value = ((await scenario.execute(new ProduceNonJsonValue())).response as { value: number }).value;
        defaultValue = ((await defaultScenario.execute(new ProduceNonJsonValue())).response as { value: number | null }).value;
    });
    afterEach(async () => { await scenario.dispose(); await defaultScenario.dispose(); });
    it('should retain a non-JSON result rather than converting it to null', () => {
        Number.isNaN(value).should.equal(true);
    });
    it('should convert the same result to null when JSON round trips are enabled', () => {
        (defaultValue === null).should.equal(true);
    });
});
