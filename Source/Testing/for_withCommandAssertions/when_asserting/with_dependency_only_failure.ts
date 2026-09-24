// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Severity, type CommandResult } from '@cratis/arc.core';
import { withCommandAssertions } from '../../withCommandAssertions.js';

describe('when asserting a dependency-only command failure', () => {
    let result: ReturnType<typeof withCommandAssertions>;
    beforeEach(() => {
        const failure: CommandResult = {
            correlationId: 'dependency', isAuthorized: true, isValid: false, hasExceptions: false, isSuccess: false,
            authorizationFailureReason: '', exceptionMessages: [], exceptionStackTrace: '',
            validationResults: [{ reason: 'dependencyUnavailable', message: 'Missing service', members: ['name'], severity: Severity.Error }]
        };
        result = withCommandAssertions(failure);
    });
    it('should refuse a generic validation assertion', () => {
        (() => result.shouldHaveValidationErrors()).should.throw('dependency');
    });
    it('should refuse a member assertion', () => {
        (() => result.shouldHaveValidationErrorFor('name')).should.throw("Expected validation error for 'name'");
    });
    it('should allow an explicit reason assertion', () => {
        result.shouldHaveValidationErrorBecauseOf('dependencyUnavailable').should.equal(result);
    });
});
