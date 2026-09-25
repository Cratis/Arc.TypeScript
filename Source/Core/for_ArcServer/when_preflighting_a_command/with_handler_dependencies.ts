// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when preflighting a command with handler dependencies', () => {
    let validationSuccess: boolean; let validationCalls: string[]; let response: unknown; let executionCalls: string[];
    beforeEach(async () => {
        const calls: string[] = []; const dependency = serviceToken<object>('dependency'); const handler = serviceToken<object>('handler');
        const server = new ArcServer({ services: [
            { token: dependency, lifetime: ServiceLifetime.Scoped,
                factory: () => {
                    calls.push('dependency');
                    return { [Symbol.asyncDispose]: async () => { calls.push('dispose dependency'); } };
                } },
            { token: handler, lifetime: ServiceLifetime.Scoped, dependencies: [dependency], factory: async resolver => {
                await resolver.resolve(dependency); calls.push('handler'); return { [Symbol.dispose]: () => { calls.push('dispose handler'); } };
            } }
        ], commands: [defineCommand({ name: 'Save', schema: z.object({}), handlerDependencies: [handler],
            validate: () => { calls.push('validate'); return []; },
            scopes: [() => ({ begin: () => { calls.push('begin'); }, complete: () => { calls.push('complete'); } })],
            provide: () => { calls.push('provide'); return 1; }, handle: () => { calls.push('handle'); return 2; } })] });
        try {
            validationSuccess = (await server.validateCommand('Save', {}, serviceContext('alpha'))).isSuccess;
            validationCalls = [...calls];
            response = (await server.executeCommand('Save', {}, serviceContext('alpha'))).response;
            executionCalls = [...calls];
        } finally { await server.dispose(); }
    });
    it('should validate without constructing handler dependencies', () => {
        validationSuccess.should.equal(true); validationCalls.should.deep.equal(['validate']);
    });
    it('should construct after validation and dispose in reverse dependency order', () => {
        (response as number).should.equal(2);
        executionCalls.should.deep.equal(['validate', 'validate', 'dependency', 'handler', 'begin', 'provide', 'handle', 'complete', 'dispose handler', 'dispose dependency']);
    });
});
