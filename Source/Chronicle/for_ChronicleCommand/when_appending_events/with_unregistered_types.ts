// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext, NotRegistered, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when appending events with unregistered types', given(a_command_with_typed_ports, context => {
    let single: { exceptions: boolean; storeCalls: [string, string][]; appends: number };
    let batch: { exceptions: boolean; storeCalls: [string, string][]; appends: number };
    beforeEach(async () => {
        const first = context.setup(async () => [accepted()], () => [{ eventSourceId: 'a', event: new NotRegistered('other') }]);
        const singleResult = await first.server.executeCommand('Place', {}, executionContext('a'));
        single = { exceptions: singleResult.hasExceptions, storeCalls: first.getEventStore.args as [string, string][], appends: first.append.callCount };
        const second = context.setup(async () => [accepted(), accepted()], () => [
            { eventSourceId: 'a', event: new Placed('first') }, { eventSourceId: 'b', event: new NotRegistered('second') }
        ]);
        const batchResult = await second.server.executeCommand('Place', {}, executionContext('b'));
        batch = { exceptions: batchResult.hasExceptions, storeCalls: second.getEventStore.args as [string, string][], appends: second.appendMany.callCount };
        await Promise.all([first.server.dispose(), second.server.dispose()]);
    });
    it('should reject an unregistered single event before append', () => {
        single.exceptions.should.equal(true);
        single.storeCalls.should.deep.include(['Tasks', 'a']);
        single.appends.should.equal(0);
    });
    it('should reject an unregistered batch event before append', () => {
        batch.exceptions.should.equal(true);
        batch.storeCalls.should.deep.include(['Tasks', 'b']);
        batch.appends.should.equal(0);
    });
}));
