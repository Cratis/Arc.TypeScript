// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, accepted, constraint, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

should();
describe('when appending a batch with mixed results', given(a_command_with_typed_ports, context => {
    const events = () => [
        { eventSourceId: 'a', event: new Placed('first'), subject: 'subject-a' },
        { eventSourceId: 'b', event: new Placed('second'), eventStreamId: 'stream-b' }
    ];
    let successful: ReturnType<typeof context.setup>;
    let successfulResult: Awaited<ReturnType<ReturnType<typeof context.setup>['server']['executeCommand']>>;
    let partial: Awaited<ReturnType<ReturnType<typeof context.setup>['server']['executeCommand']>>;
    let rejected: typeof partial;
    let distinct: typeof partial;
    beforeEach(async () => {
        successful = context.setup(async () => [accepted(), accepted()], events);
        successfulResult = await successful.server.executeCommand('Place', {}, executionContext('a'));
        const mixed = context.setup(async () => [accepted(), constraint()], events);
        partial = await mixed.server.executeCommand('Place', {}, executionContext('a'));
        const allRejected = context.setup(async () => [constraint(), constraint()], events);
        rejected = await allRejected.server.executeCommand('Place', {}, executionContext('a'));
        const different = context.setup(async () => [constraint(), { ...constraint(), constraintViolations: [{ constraintId: 'other', message: 'taken', details: {} }] }], events);
        distinct = await different.server.executeCommand('Place', {}, executionContext('a'));
        await Promise.all([successful.server.dispose(), mixed.server.dispose(), allRejected.server.dispose(), different.server.dispose()]);
    });
    it('should return the command response after a complete append', () => successfulResult.response!.should.equal('done'));
    it('should forward batch metadata and the produced events', () => {
        successful.appendMany.args[0]![0].should.deep.equal(events());
        successful.appendMany.args[0]![1].should.have.all.keys('correlationId');
        successful.appendMany.args[0]![1].should.have.property('correlationId').that.is.a('string');
    });
    it('should fail closed on partial success', () => {
        partial.hasExceptions.should.equal(true);
        (partial.response === undefined).should.equal(true);
    });
    it('should translate complete constraint rejection to a validation result', () => {
        rejected.hasExceptions.should.equal(false);
        rejected.validationResults.map(issue => issue.reason).should.deep.equal(['constraintViolation']);
        (rejected.response === undefined).should.equal(true);
    });
    it('should retain distinct constraint identifiers', () => distinct.validationResults.map(issue => issue.reasonDetail).should.deep.equal(['unique', 'other']));
}));
