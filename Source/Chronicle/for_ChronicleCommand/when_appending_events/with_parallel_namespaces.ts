// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when appending events with parallel namespaces', given(a_command_with_typed_ports, context => {
    let results: unknown[];
    let store: ReturnType<typeof context.setup>;
    let first: ReturnType<typeof executionContext>;
    let second: ReturnType<typeof executionContext>;
    beforeEach(async () => {
        store = context.setup(async () => [accepted()]);
        first = executionContext('a');
        second = executionContext('b');
        results = await Promise.all([store.server.executeCommand('Place', {}, first), store.server.executeCommand('Place', {}, second)]);
        await store.server.dispose();
    });
    it('should return the command response for both namespaces', () => results.map(result => (result as { response: unknown }).response).should.deep.equal(['done', 'done']));
    it('should resolve each tenant store independently', () => store.getEventStore.args.should.deep.equal([['Tasks', 'a'], ['Tasks', 'b']]));
    it('should append distinct produced events to each store', () => {
        store.append.args.map(call => call[0]).should.deep.equal(['a', 'a']);
        store.append.args.map(call => call[1]).should.deep.equal([new Placed('first'), new Placed('first')]);
        store.append.callCount.should.equal(2);
    });
    it('should forward per-call correlation and metadata', () => {
        store.append.args[0]![2].should.deep.include({ correlationId: first.correlationId, subject: 'person-1', streamType: 'tasks', tags: ['created'] });
        store.append.args[1]![2].should.deep.include({ correlationId: second.correlationId, subject: 'person-1', streamType: 'tasks', tags: ['created'] });
    });
}));
