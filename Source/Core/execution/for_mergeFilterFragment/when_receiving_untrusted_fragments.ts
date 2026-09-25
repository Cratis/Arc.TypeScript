// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { mergeFilterFragment } from '../mergeFilterFragment.js';
import { Severity } from '../../validation/Severity.js';
import { validation } from '../../validation/ValidationResult.js';
import type { ValidationResult } from '../../validation/ValidationResult.js';
should();

const current = () => ({ isAuthorized: true, isReady: true, authorizationFailureReason: '',
    validationResults: [] as ValidationResult[], exceptionMessages: [] as string[], exceptionStackTrace: '' });
const invalid = (fragment: object) => () => mergeFilterFragment(current(), fragment as Partial<ReturnType<typeof current>>);
const sparse = <T>(value: T): T[] => { const items = new Array<T>(2); items[0] = value; return items; };

for (const [name, fragment] of [
    ['inherited authorization', Object.create({ isAuthorized: 'false' })],
    ['inherited readiness', Object.create({ isReady: 'false' })],
    ['sparse results', { validationResults: sparse(validation('Warning', [], 'rule', Severity.Warning)) }],
    ['sparse messages', { exceptionMessages: sparse('first') }],
    ['sparse warning members', { validationResults: [validation('Warning', sparse('first'), 'rule', Severity.Warning)] }],
    ['nested results', { validationResults: [[validation('nested')]] }],
    ['nested messages', { exceptionMessages: [['nested']] }]
] as const) describe(`when a fragment has ${name}`, () => {
    it('should reject it before any severity filtering', () => {
        invalid(fragment).should.throw(TypeError, 'Invalid filter result fragment');
    });
});

for (const [name, field, first, second] of [
    ['authorization', 'isAuthorized', false, true],
    ['readiness', 'isReady', false, true],
    ['reason', 'authorizationFailureReason', 'first', 42]
] as const) describe(`when ${name} changes on read`, () => {
    it('should use only the first validated value', () => {
        let reads = 0;
        const fragment = { get [field]() { return ++reads === 1 ? first : second; } };
        const result = mergeFilterFragment(current(), fragment as Partial<ReturnType<typeof current>>);
        reads.should.equal(1);
        if (field === 'isAuthorized') result.isAuthorized.should.equal(false);
        if (field === 'isReady') result.isReady.should.equal(false);
        if (field === 'authorizationFailureReason') result.authorizationFailureReason.should.equal('first');
    });
});

describe('when a validation severity changes on read', () => {
    it('should snapshot a dense validation result before it can disappear', () => {
        let reads = 0;
        const fragment = { validationResults: [{ get severity() { return ++reads === 1 ? Severity.Error : NaN; },
            message: 'error', members: ['value'], reason: 'rule' }] };
        const result = mergeFilterFragment(current(), fragment);
        reads.should.equal(1);
        result.validationResults[0]!.severity.should.equal(Severity.Error);
        result.validationResults[0]!.members.should.deep.equal(['value']);
        result.validationResults[0]!.should.not.equal(fragment.validationResults[0]);
    });
});

describe('when nested validation and exception fields change on read', () => {
    it('should use one validated snapshot of each field and make dense copies', () => {
        let messageReads = 0;
        let membersReads = 0;
        let exceptionReads = 0;
        const fragment = {
            validationResults: [{ severity: Severity.Error, get message() { return ++messageReads === 1 ? 'first' : 5; },
                get members() { return ++membersReads === 1 ? ['member'] : [false]; }, reason: 'rule' }],
            get exceptionMessages() { return ++exceptionReads === 1 ? ['exception'] : [false]; }
        };
        const result = mergeFilterFragment(current(), fragment as Partial<ReturnType<typeof current>>);
        messageReads.should.equal(1);
        membersReads.should.equal(1);
        exceptionReads.should.equal(1);
        result.validationResults[0]!.message.should.equal('first');
        result.validationResults[0]!.members.should.deep.equal(['member']);
        result.exceptionMessages.should.deep.equal(['exception']);
    });
});

describe('when a fragment has only optional fields', () => {
    it('should preserve a partial validation and exception fragment without changing its source', () => {
        const fragment = { validationResults: [validation('warning', ['value'], 'rule', Severity.Warning)],
            exceptionMessages: ['failure'] };
        const result = mergeFilterFragment(current(), fragment);
        result.validationResults.should.deep.equal(fragment.validationResults);
        result.exceptionMessages.should.deep.equal(['failure']);
        result.validationResults.should.not.equal(fragment.validationResults);
        result.exceptionMessages.should.not.equal(fragment.exceptionMessages);
    });
});
