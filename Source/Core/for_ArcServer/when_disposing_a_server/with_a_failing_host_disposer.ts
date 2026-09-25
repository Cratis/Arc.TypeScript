// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { beforeDeadline, captureFailure, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when disposing a server with a failing host disposer', () => {
    let success: boolean;
    let response: unknown;
    let shutdownFailure: unknown;
    let repeatedFailure: unknown;
    beforeEach(async () => {
        const failing = serviceToken<object>('host cleanup');
        const entered = gate(); const release = gate();
        const server = new ArcServer({ services: [{ token: failing, lifetime: ServiceLifetime.Scoped, factory: () => ({
            [Symbol.dispose]: () => { throw new Error('host teardown failed'); }
        }) }], commands: [defineCommand({ name: 'Commit', schema: z.object({}), handle: async () => {
            entered.release(); await release.promise; return 'committed';
        } })] });
        const manual = server.services.createScope(serviceContext('host'));
        try {
            await manual.resolve(failing);
            const work = server.executeCommand('Commit', {}, serviceContext('caller'));
            await entered.promise;
            const shutdown = server.dispose();
            release.release();
            const result = await beforeDeadline(work, 'committed host result');
            success = result.isSuccess; response = result.response;
            shutdownFailure = await captureFailure(beforeDeadline(shutdown, 'host cleanup failure'));
        } finally { release.release(); repeatedFailure = await captureFailure(server.dispose()); }
    });
    it('should preserve the committed response', () => {
        success.should.equal(true);
        (response as string).should.equal('committed');
    });
    it('should report the host cleanup failure on shutdown and repeated shutdown', () => {
        (shutdownFailure as Error).message.should.match(/Service registry disposal failed/);
        (repeatedFailure as Error).message.should.match(/Service registry disposal failed/);
    });
});
