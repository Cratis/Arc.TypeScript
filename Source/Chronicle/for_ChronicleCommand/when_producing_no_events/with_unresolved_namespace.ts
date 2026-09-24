// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, executionContext } from '../given/a_command_with_typed_ports.js';

should();
describe('when producing no events with an unresolved namespace', given(a_command_with_typed_ports, context => {
    let resolved: Awaited<ReturnType<ReturnType<typeof context.setup>['server']['executeCommand']>>;
    let unresolved: typeof resolved;
    let store: ReturnType<typeof context.setup>;
    beforeEach(async () => {
        store = context.setup(async () => [], () => []);
        resolved = await store.server.executeCommand('Place', {}, executionContext('a'));
        unresolved = await store.server.executeCommand('Place', {}, executionContext(''));
        await store.server.dispose();
    });
    it('should permit an empty event list for a resolved namespace', () => resolved.response!.should.equal('done'));
    it('should fail closed for the unresolved namespace', () => {
        unresolved.hasExceptions.should.equal(true);
        (unresolved.response === undefined).should.equal(true);
    });
    it('should not request a store for either empty append', () => store.getEventStore.callCount.should.equal(0));
}));
