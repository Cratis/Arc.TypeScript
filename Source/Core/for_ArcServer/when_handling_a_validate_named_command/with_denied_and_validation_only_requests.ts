// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when handling a validate named command with denied and validation only requests', () => {
    let deniedStatus: number | undefined; let afterDenial: string[];
    let validationSuccess: boolean; let afterValidation: string[];
    let httpStatus: number | undefined; let afterHttp: string[];
    beforeEach(async () => {
        const events: string[] = []; const validator = serviceToken<object>('validator'); const handler = serviceToken<object>('handler');
        const server = new ArcServer({ services: [
            { token: validator, lifetime: 'scoped', factory: () => { events.push('validator'); return { [Symbol.dispose]: () => { events.push('validator disposed'); } }; } },
            { token: handler, lifetime: 'scoped', factory: () => { events.push('handler'); return {}; } }
        ], commands: [defineCommand({ name: 'Submit', schema: z.object({}), authorization: { authenticated: true },
            handlerDependencies: [handler], validatorDependencies: [validator],
            validate: () => { events.push('validate'); return []; }, handle: () => { events.push('handle'); return 1; } })] });
        const url = 'http://localhost/api/submit/validate';
        deniedStatus = (await server.handle(new Request(url, { method: 'POST', body: '{}' })))?.status;
        afterDenial = [...events];
        validationSuccess = (await server.validateCommand('Submit', {}, { ...serviceContext('alpha'),
            principal: { id: 'a', isAuthenticated: true, roles: [] } })).isSuccess;
        afterValidation = [...events];
        const http = new ArcServer({ services: [{ token: handler, lifetime: 'scoped', factory: () => { events.push('http factory'); return {}; } }],
            commands: [defineCommand({ name: 'Submit', schema: z.object({}), handlerDependencies: [handler], handle: () => { events.push('http handle'); return 1; } })] });
        httpStatus = (await http.handle(new Request(url, { method: 'POST', body: '{}' })))?.status;
        afterHttp = [...events];
        await http.dispose(); await server.dispose();
    });
    it('should not create handler or validator services for a denied request', () => {
        (deniedStatus as number).should.equal(403); afterDenial.should.deep.equal([]);
    });
    it('should create only validator services for validation only execution', () => {
        validationSuccess.should.equal(true);
        afterValidation.should.deep.equal(['validator', 'validate', 'validator disposed']);
    });
    it('should not create handler services for an HTTP validate route', () => {
        (httpStatus as number).should.equal(200);
        afterHttp.should.deep.equal(['validator', 'validate', 'validator disposed']);
    });
});
