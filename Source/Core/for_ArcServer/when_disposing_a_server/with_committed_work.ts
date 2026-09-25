// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { ServiceScope, currentServices } from '../../dependencyInjection/ServiceScope.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { captureFailure, beforeDeadline, gate, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when disposing a server with committed work', () => {
    let success: boolean;
    let response: unknown;
    let effects: number;
    let newWorkFailure: unknown;
    let manualFailure: unknown;
    let directFailure: unknown;
    beforeEach(async () => {
        const late = serviceToken<object>('late dependency');
        const started = gate(); const release = gate(); effects = 0;
        const server = new ArcServer({ services: [{ token: late, lifetime: ServiceLifetime.Scoped, factory: () => ({}) }], commands: [
            defineCommand({ name: 'Commit', schema: z.object({}), handle: async () => {
                effects++; started.release(); await release.promise;
                await currentServices().resolve(late);
                return 'committed';
            } })
        ] });
        try {
            const work = server.executeCommand('Commit', {}, serviceContext('alpha'));
            await started.promise;
            const closing = server.dispose();
            newWorkFailure = await captureFailure(server.executeCommand('Commit', {}, serviceContext('beta')));
            manualFailure = await captureFailure(Promise.resolve().then(() => server.services.createScope(serviceContext('manual'))));
            directFailure = await captureFailure(Promise.resolve().then(() => new ServiceScope(server.services, serviceContext('direct'))));
            release.release();
            const result = await beforeDeadline(work, 'committed command');
            success = result.isSuccess; response = result.response;
            await beforeDeadline(closing, 'committed shutdown');
        } finally { release.release(); await server.dispose(); }
    });
    it('should complete admitted work and allow its dependencies to resolve', () => {
        success.should.equal(true);
        (response as string).should.equal('committed');
        effects.should.equal(1);
    });
    it('should reject new work and scopes', () => {
        (newWorkFailure as Error).message.should.match(/disposed/);
        (manualFailure as Error).message.should.match(/disposed/);
        (directFailure as Error).message.should.match(/disposed/);
    });
});
