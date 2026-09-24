// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Severity, type CommandResult } from '@cratis/arc.core';
import { withCommandAssertions } from '../../withCommandAssertions.js';

describe('when asserting a validation message and a member', () => {
    let result: ReturnType<typeof withCommandAssertions>;
    beforeEach(() => {
        const failure: CommandResult = {
            correlationId: 'validation', isAuthorized: true, isValid: false, hasExceptions: false, isSuccess: false,
            authorizationFailureReason: '', exceptionMessages: [], exceptionStackTrace: '',
            validationResults: [{ reason: 'rule', message: 'Title is required', members: ['title'], severity: Severity.Error }]
        };
        result = withCommandAssertions(failure);
    });
    it('should match part of the message rather than the member', () => {
        result.shouldHaveValidationErrorFor('is required').should.equal(result);
        (() => result.shouldHaveValidationErrorFor('title')).should.throw('Expected validation error containing');
    });
    it('should match the member separately from the message', () => {
        result.shouldHaveValidationErrorForMember('title').should.equal(result);
        (() => result.shouldHaveValidationErrorForMember('missing')).should.throw('Expected validation error for member');
    });
});
