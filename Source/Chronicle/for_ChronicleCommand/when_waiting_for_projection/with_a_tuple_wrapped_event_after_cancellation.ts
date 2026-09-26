// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { tuple } from '@cratis/arc.core';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when a tuple contains an event after an acknowledged append and cancellation', given(a_command_with_typed_ports, context => {
    let success: boolean;
    let response: unknown;
    let appends: number;
    beforeEach(async () => {
        const abort = new AbortController();
        const { server, append } = context.setup(async () => { abort.abort(new Error('request canceled')); return [accepted()]; },
            undefined, [Placed], tuple(new Placed('unappended')));
        try {
            const result = await server.executeCommand('Place', {}, { ...executionContext('a'), signal: abort.signal });
            success = result.isSuccess;
            response = result.response;
            appends = append.callCount;
        } finally { await server.dispose(); }
    });
    it('should not return the unappended event as a successful client response', () => {
        success.should.equal(false);
        (response === undefined).should.equal(true);
        appends.should.equal(1);
    });
}));
