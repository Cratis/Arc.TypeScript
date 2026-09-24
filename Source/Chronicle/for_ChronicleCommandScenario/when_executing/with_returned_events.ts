// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key } from '@cratis/arc.core';
import { ChronicleCommandScenario } from '../../testing/index.js';

@eventType() class Registered { @field(String) name = ''; }
@command() class Register {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle(): Registered { return Object.assign(new Registered(), { name: this.name }); }
}

describe('when executing a Chronicle command without a kernel', () => {
    let scenario: ChronicleCommandScenario<Register>;
    beforeEach(() => { scenario = ChronicleCommandScenario.for(Register, Registered); });
    afterEach(async () => { await scenario.dispose(); });
    it('should record the appended event by its source and value', async () => {
        const result = await scenario.execute({ id: 'source-1', name: 'Ada' });
        result.isSuccess.should.equal(true);
        result.shouldHaveAppendedEvent(Registered, 'source-1', event => event.name === 'Ada');
        scenario.appendedEvents.should.have.lengthOf(1);
    });
    it('should reject an assertion for an event that was not appended', async () => {
        const result = await scenario.execute({ id: 'source-1', name: 'Ada' });
        (() => result.shouldHaveAppendedEvent(Registered, 'wrong-source')).should.throw('Expected Registered to have been appended to wrong-source');
    });
});
