// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when appending a batch with an empty SDK result', given(a_command_with_typed_ports, context => {
    let result: Awaited<ReturnType<ReturnType<typeof context.setup>['server']['executeCommand']>>;
    let appendCount: number;
    beforeEach(async () => {
        const { server, appendMany } = context.setup(async () => [], () => [
            { eventSourceId: 'a', event: new Placed('first') }, { eventSourceId: 'a', event: new Placed('second') }
        ]);
        result = await server.executeCommand('Place', {}, executionContext('a'));
        appendCount = appendMany.callCount;
        await server.dispose();
    });
    it('should attempt the batch append', () => appendCount.should.equal(1));
    it('should fail closed rather than invent a constraint verdict', () => {
        result.hasExceptions.should.equal(true);
        result.isSuccess.should.equal(false);
        result.validationResults.should.deep.equal([]);
        (result.response === undefined).should.equal(true);
    });
}));
