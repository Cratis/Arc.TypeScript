// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { command, key } from '@cratis/arc.core';
import { ChronicleCommandScenario } from '../../index.js';
import { eventSourceType, eventForEventSourceId } from '../../../index.js';

@eventType() class Registered { @field(String) name: string; constructor(name = '') { this.name = name; } }
@command() @eventSourceType('Task', { concurrency: true }) class Register {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle(): Registered { return new Registered(this.name); }
}

@command() class RegisterRouted {
    @field(String) @key() id = '';
    handle() { return eventForEventSourceId({ eventSourceId: 'routed', event: new Registered(),
        eventSourceType: 'Override', subject: 'subject-1', tags: ['tag-1'] }); }
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
        String(result.appendedEvents[0]!.eventSourceType).should.equal('Task');
    });
    it('should scope an assertion to the current execution', async () => {
        await scenario.execute({ id: 'source-1', name: 'Ada' });
        const second = await scenario.execute({ id: 'source-2', name: 'Grace' });
        (() => second.shouldHaveAppendedEvent(Registered, 'source-1')).should.throw('Expected Registered');
        second.shouldHaveAppendedEvent(Registered, 'source-2');
    });
    it('should record explicit event routing, subject, and tags', async () => {
        const routed = ChronicleCommandScenario.for(RegisterRouted, Registered);
        try {
            const result = await routed.execute({ id: 'unused' });
            result.isSuccess.should.equal(true);
            result.shouldHaveAppendedEvent(Registered, 'routed');
            String(result.appendedEvents[0]!.eventSourceType).should.equal('Override');
            String(result.appendedEvents[0]!.subject).should.equal('subject-1');
            result.appendedEvents[0]!.tags!.should.deep.equal(['tag-1']);
        } finally { await routed.dispose(); }
    });
    it('should reject an assertion for an event that was not appended', async () => {
        const result = await scenario.execute({ id: 'source-1', name: 'Ada' });
        (() => result.shouldHaveAppendedEvent(Registered, 'wrong-source')).should.throw('Expected Registered to have been appended to wrong-source');
    });
});
