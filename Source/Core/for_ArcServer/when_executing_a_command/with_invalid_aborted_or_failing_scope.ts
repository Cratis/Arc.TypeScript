// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';
import { Severity } from '../../validation/Severity.js';
import { validation } from '../../validation/ValidationResult.js';

should();
describe('when executing a command with invalid aborted or failing scope', () => {
    let invalid: boolean; let scopeException: boolean; let abortedSuccess: boolean;
    let afterInvalid: string[]; let afterScope: string[]; let afterAbort: string[];
    beforeEach(async () => {
        const events: string[] = []; const validator = serviceToken<object>('validator'); const handler = serviceToken<object>('handler');
        const server = new ArcServer({ services: [
            { token: validator, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.dispose]: () => { events.push('validator disposed'); } }) },
            { token: handler, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.dispose]: () => { events.push('handler disposed'); } }) }
        ], commands: [
            defineCommand({ name: 'Invalid', schema: z.object({}), validatorDependencies: [validator], handlerDependencies: [handler],
                validate: () => [validation('no', [], 'rule', Severity.Error)], handle: () => { events.push('unexpected'); } }),
            defineCommand({ name: 'Scope', schema: z.object({}), handlerDependencies: [handler],
                scopes: [() => ({ begin: () => { throw new Error('scope failed'); }, complete: () => { events.push('complete'); } })],
                handle: () => { events.push('unexpected'); } }),
            defineCommand({ name: 'Abort', schema: z.object({}), validatorDependencies: [validator],
                validate: (_input, execution) => { if (execution.signal.aborted) throw new Error('aborted'); return []; },
                handle: () => { events.push('unexpected'); } })
        ] });
        invalid = !(await server.executeCommand('Invalid', {}, serviceContext('alpha'))).isValid;
        afterInvalid = [...events];
        scopeException = (await server.executeCommand('Scope', {}, serviceContext('alpha'))).hasExceptions;
        afterScope = [...events];
        const cancelled = new AbortController(); cancelled.abort();
        abortedSuccess = (await server.executeCommand('Abort', {}, { ...serviceContext('alpha'), signal: cancelled.signal })).isSuccess;
        afterAbort = [...events];
        await server.dispose();
    });
    it('should dispose validator services after invalid and aborted validation', () => {
        invalid.should.equal(true); afterInvalid.should.deep.equal(['validator disposed']);
        abortedSuccess.should.equal(false);
        afterAbort.should.deep.equal(['validator disposed', 'complete', 'handler disposed', 'validator disposed']);
    });
    it('should complete a failing scope and dispose its handler without calling it', () => {
        scopeException.should.equal(true);
        afterScope.should.deep.equal(['validator disposed', 'complete', 'handler disposed']);
    });
});
