// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import type { IEventStore } from '@cratis/chronicle';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when cancelling a command around persistence', given(a_command_with_typed_ports, context => {
    let produced: { exceptions: boolean; stores: number; appends: number };
    let resolved: { exceptions: boolean; appends: number };
    let acknowledged: { response: unknown; success: boolean; appends: number };
    beforeEach(async () => {
        const duringProduce = new AbortController();
        const beforeProduce = context.setup(async () => [accepted()], () => { duringProduce.abort(); return [{ eventSourceId: 'a', event: new Placed('first') }]; });
        const first = await beforeProduce.server.executeCommand('Place', {}, { ...executionContext('a'), signal: duringProduce.signal });
        produced = { exceptions: first.hasExceptions, stores: beforeProduce.getEventStore.callCount, appends: beforeProduce.append.callCount };
        const duringStore = new AbortController();
        const afterStore = context.setup(async () => [accepted()]);
        afterStore.getEventStore.onFirstCall().callsFake(async () => {
            duringStore.abort();
            return { eventTypes: { all: [Placed] }, eventLog: { append: afterStore.append, appendMany: afterStore.appendMany } } as unknown as IEventStore;
        });
        const second = await afterStore.server.executeCommand('Place', {}, { ...executionContext('a'), signal: duringStore.signal });
        resolved = { exceptions: second.hasExceptions, appends: afterStore.append.callCount };
        const afterAck = new AbortController();
        const persisted = context.setup(async () => { afterAck.abort(); return [accepted()]; });
        const third = await persisted.server.executeCommand('Place', {}, { ...executionContext('a'), signal: afterAck.signal });
        acknowledged = { response: third.response, success: third.isSuccess, appends: persisted.append.callCount };
        await Promise.all([beforeProduce.server.dispose(), afterStore.server.dispose(), persisted.server.dispose()]);
    });
    it('should abort before store lookup when cancelled during production', () => {
        produced.exceptions.should.equal(true);
        produced.stores.should.equal(0);
        produced.appends.should.equal(0);
    });
    it('should abort before append when cancelled during store resolution', () => {
        resolved.exceptions.should.equal(true);
        resolved.appends.should.equal(0);
    });
    it('should not invent rollback after the append was acknowledged', () => {
        acknowledged.appends.should.equal(1);
        acknowledged.response!.should.equal('done');
        acknowledged.success.should.equal(true);
    });
}));
