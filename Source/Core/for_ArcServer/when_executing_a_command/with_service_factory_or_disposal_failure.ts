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
describe('when executing a command with service factory or disposal failure', () => {
    let factorySuccess: boolean; let factoryReason: string | undefined; let events: string[];
    let disposalSuccess: boolean; let disposalResponse: unknown; let disposalMessage: string;
    beforeEach(async () => {
        events = []; const first = serviceToken<object>('first'); const last = serviceToken<object>('last');
        const server = new ArcServer({ services: [
            { token: first, lifetime: ServiceLifetime.Scoped,
                factory: () => ({ [Symbol.asyncDispose]: async () => { events.push('first disposed'); } }) },
            { token: last, lifetime: ServiceLifetime.Scoped, dependencies: [first],
                factory: async resolver => { await resolver.resolve(first); throw new Error('factory failed'); } }
        ], commands: [defineCommand({ name: 'Fail', schema: z.object({}), handlerDependencies: [last], handle: () => { events.push('handle'); return 1; } })] });
        const failed = await server.executeCommand('Fail', {}, serviceContext('alpha'));
        factorySuccess = failed.isSuccess; factoryReason = failed.validationResults[0]?.reason;
        await server.dispose();
        const broken = serviceToken<object>('broken');
        const other = new ArcServer({ services: [{ token: broken, lifetime: ServiceLifetime.Scoped,
            factory: () => ({ [Symbol.asyncDispose]: async () => { throw new Error('dispose failed'); } }) }],
            commands: [defineCommand({ name: 'Reply', schema: z.object({}), handlerDependencies: [broken], handle: () => 'secret' })] });
        const result = await other.executeCommand('Reply', {}, serviceContext('beta'));
        disposalSuccess = result.isSuccess; disposalResponse = result.response; disposalMessage = result.exceptionMessages[0] ?? '';
        await other.dispose();
    });
    it('should dispose the partial graph without running a failed handler', () => {
        factorySuccess.should.equal(false); (factoryReason as string).should.equal('dependencyUnavailable');
        events.should.deep.equal(['first disposed']);
    });
    it('should clear the response and report a disposer failure', () => {
        disposalSuccess.should.equal(false); (disposalResponse === undefined).should.equal(true);
        disposalMessage.should.match(/disposal failed/);
    });
});
