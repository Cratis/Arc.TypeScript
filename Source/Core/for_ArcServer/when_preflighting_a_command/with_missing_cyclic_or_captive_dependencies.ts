// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when preflighting a command with missing cyclic or captive dependencies', () => {
    let reasons: (string | undefined)[]; let successes: boolean[]; let calls: string[];
    beforeEach(async () => {
        const missing = serviceToken<object>('missing'); const cycleA = serviceToken<object>('cycle A');
        const cycleB = serviceToken<object>('cycle B'); const singleton = serviceToken<object>('singleton');
        const scoped = serviceToken<object>('scoped'); calls = [];
        const server = new ArcServer({ services: [
            { token: cycleA, lifetime: 'scoped', dependencies: [cycleB], factory: () => ({}) },
            { token: cycleB, lifetime: 'scoped', dependencies: [cycleA], factory: () => ({}) },
            { token: singleton, lifetime: 'singleton', dependencies: [scoped], factory: () => ({}) },
            { token: scoped, lifetime: 'scoped', factory: () => ({}) }
        ], commands: [missing, cycleA, singleton].map((token, index) => defineCommand({ name: `Action${index}`, schema: z.object({}), handlerDependencies: [token],
            validate: () => { calls.push('validate'); return []; }, provide: () => { calls.push('provide'); }, handle: () => { calls.push('handle'); } })) });
        try {
            const outcomes = await Promise.all([0, 1, 2].map(index => server.validateCommand(`Action${index}`, {}, serviceContext('alpha'))));
            reasons = outcomes.map(result => result.validationResults[0]?.reason);
            successes = outcomes.map(result => result.isSuccess);
        } finally { await server.dispose(); }
    });
    it('should reject all three dependency graphs before handler effects', () => {
        reasons.should.deep.equal(['dependencyUnavailable', 'dependencyUnavailable', 'dependencyUnavailable']);
        successes.should.deep.equal([false, false, false]); calls.should.deep.equal([]);
    });
});
