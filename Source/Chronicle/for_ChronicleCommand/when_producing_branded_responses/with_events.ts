// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { denied, rejected, response, validation } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when producing branded responses with events', given(a_command_with_typed_ports, context => {
    let failures: { exceptions: boolean; response: unknown; appends: number; stores: number }[];
    let noEvents: { authorized: boolean; stores: number };
    beforeEach(async () => {
        failures = [];
        for (const outcome of [rejected(validation('bad')), denied('no access'), response('value')]) {
            const { server, append, getEventStore } = context.setup(async () => [accepted()], undefined, [Placed], outcome);
            const result = await server.executeCommand('Place', {}, executionContext('a'));
            failures.push({ exceptions: result.hasExceptions, response: result.response, appends: append.callCount, stores: getEventStore.callCount });
            await server.dispose();
        }
        const { server, getEventStore } = context.setup(async () => [], () => [], [Placed], denied('no access'));
        const result = await server.executeCommand('Place', {}, executionContext('a'));
        noEvents = { authorized: result.isAuthorized, stores: getEventStore.callCount };
        await server.dispose();
    });
    it('should reject branded responses before persistence', () => {
        failures.should.have.lengthOf(3);
        for (const result of failures) {
            result.exceptions.should.equal(true);
            (result.response === undefined).should.equal(true);
            result.appends.should.equal(0);
            result.stores.should.equal(0);
        }
    });
    it('should return a denial without looking up a store when no events are produced', () => {
        noEvents.authorized.should.equal(false);
        noEvents.stores.should.equal(0);
    });
}));
