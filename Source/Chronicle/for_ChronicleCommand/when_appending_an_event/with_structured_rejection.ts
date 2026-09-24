// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { a_command_with_typed_ports, concurrency, constraint, executionContext, sequenceNumber } from '../given/a_command_with_typed_ports.js';

should();
describe('when appending an event with structured rejection', given(a_command_with_typed_ports, context => {
    let result: Awaited<ReturnType<ReturnType<typeof context.setup>['server']['executeCommand']>>;
    let acronym: typeof result;
    let conflict: typeof result;
    beforeEach(async () => {
        const first = context.setup(async () => [{ ...constraint(), constraintViolations: [{ constraintId: 'unique', message: '', details: { PropertyName: 'FirstName' } }] }]);
        result = await first.server.executeCommand('Place', {}, executionContext('a'));
        const second = context.setup(async () => [{ ...constraint(), constraintViolations: [{ constraintId: 'acronym', message: 'taken', details: { PropertyName: 'URL' } }] }]);
        acronym = await second.server.executeCommand('Place', {}, executionContext('a'));
        const third = context.setup(async () => [{ ...concurrency(), concurrencyViolation: { eventSourceId: 'a', expectedSequenceNumber: sequenceNumber(9007199254740993n), actualSequenceNumber: sequenceNumber(9007199254740995n) } }]);
        conflict = await third.server.executeCommand('Place', {}, executionContext('a'));
        await Promise.all([first.server.dispose(), second.server.dispose(), third.server.dispose()]);
    });
    it('should fail without publishing a response', () => {
        result.isSuccess.should.equal(false);
        (result.response === undefined).should.equal(true);
        result.validationResults.should.have.lengthOf(1);
    });
    it('should normalize constraint names and property members', () => result.validationResults[0]!.should.deep.include({
        reason: 'constraintViolation', reasonDetail: 'unique', message: 'unique', members: ['firstName'] }));
    it('should retain acronym member names', () => acronym.validationResults[0]!.members.should.deep.equal(['URL']));
    it('should preserve exact concurrency sequence numbers in serializable state', () => {
        conflict.validationResults.should.have.lengthOf(1);
        conflict.validationResults[0]!.should.have.property('reason', 'concurrencyViolation');
        (conflict.validationResults[0]!.state as object).should.deep.include({ eventSourceId: 'a',
            expectedEventSequenceNumber: '9007199254740993', actualEventSequenceNumber: '9007199254740995' });
        (() => JSON.stringify(conflict)).should.not.throw();
        (conflict.response === undefined).should.equal(true);
    });
}));
