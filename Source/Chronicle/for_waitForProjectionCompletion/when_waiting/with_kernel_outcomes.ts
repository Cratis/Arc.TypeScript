// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { accepted } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';
import { waitForProjectionCompletion } from '../../waitForProjectionCompletion.js';

describe('when waiting for Chronicle projection completion', () => {
    it('should use the last append acknowledgment and configured bound', async () => {
        const first = sinon.spy(async (timeout?: number) => { void timeout; return { isSuccess: true, failedPartitions: [] }; });
        const last = sinon.spy(async (timeout?: number) => { void timeout; return { isSuccess: true, failedPartitions: [] }; });
        await waitForProjectionCompletion([{ ...accepted(), waitForCompletion: first },
            { ...accepted(), waitForCompletion: last }], 2500, new AbortController().signal);
        first.called.should.equal(false);
        last.calledOnceWithExactly(2500).should.equal(true);
    });
    it('should report failed observer partitions instead of treating a committed append as synchronized', async () => {
        const acknowledgment = { ...accepted(), waitForCompletion: async () => ({ isSuccess: false, failedPartitions: [{} as never] }) };
        await waitForProjectionCompletion([acknowledgment], 2500, new AbortController().signal).should.be.rejectedWith(
            'Chronicle append committed, but observer completion failed for 1 partition(s)');
    });
    it('should stop waiting without failing an acknowledged append when canceled', async () => {
        const abort = new AbortController();
        const pending = { ...accepted(), waitForCompletion: async () => new Promise<never>(() => {}) };
        const promise = waitForProjectionCompletion([pending], 2500, abort.signal);
        abort.abort(new Error('request canceled'));
        await promise.should.be.fulfilled;
    });
    it('should refuse an unbounded wait', async () => {
        await waitForProjectionCompletion([accepted()], 0, new AbortController().signal).should.be.rejectedWith(
            'Chronicle completion timeout must be a positive integer in milliseconds');
    });
});
