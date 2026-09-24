// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import type { AppendResult } from '@cratis/chronicle/eventSequences';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, concurrency, constraint, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when appending events with unknown results', given(a_command_with_typed_ports, context => {
    let outcomes: { exceptions: boolean; response: unknown }[];
    let batches: { exceptions: boolean; response: unknown; calls: number }[];
    beforeEach(async () => {
        const cases: Array<() => Promise<AppendResult[]>> = [
            async () => [{ ...accepted(), isSuccess: false }],
            async () => [{ ...accepted(), isSuccess: 'true' as unknown as boolean }],
            async () => [{ ...constraint(), isSuccess: true }],
            async () => [{ ...concurrency(), isSuccess: true }],
            async () => [{ ...accepted(), errors: [{ message: 'bad' }] }],
            async () => { throw new Error('transport'); }
        ];
        outcomes = [];
        for (const produce of cases) {
            const { server } = context.setup(produce);
            const result = await server.executeCommand('Place', {}, executionContext('a'));
            outcomes.push({ exceptions: result.hasExceptions, response: result.response });
            await server.dispose();
        }
        batches = [];
        const events = () => [{ eventSourceId: 'a', event: new Placed('first') }, { eventSourceId: 'a', event: new Placed('second') }];
        for (const produce of [async () => [accepted()], async () => [], async () => [constraint(), { ...accepted(), isSuccess: false }]]) {
            const { server, appendMany } = context.setup(produce, events);
            const result = await server.executeCommand('Place', {}, executionContext('a'));
            batches.push({ exceptions: result.hasExceptions, response: result.response, calls: appendMany.callCount });
            await server.dispose();
        }
    });
    it('should fail closed for every unknown or inconsistent single append', () => {
        outcomes.should.have.lengthOf(6);
        for (const result of outcomes) {
            result.exceptions.should.equal(true);
            (result.response === undefined).should.equal(true);
        }
    });
    it('should fail closed for mismatched or inconsistent batch results', () => {
        batches.should.have.lengthOf(3);
        for (const result of batches) {
            result.exceptions.should.equal(true);
            (result.response === undefined).should.equal(true);
            result.calls.should.equal(1);
        }
    });
}));
