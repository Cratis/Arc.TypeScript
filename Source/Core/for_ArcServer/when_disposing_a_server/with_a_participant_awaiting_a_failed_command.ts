// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { ServiceLifetime } from '../../dependencyInjection/ServiceLifetime.js';
import { serviceToken } from '../../dependencyInjection/ServiceToken.js';
import { currentServices } from '../../dependencyInjection/ServiceScope.js';
import { beforeDeadline, captureFailure, serviceContext } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a participant drains a command that fails to construct a singleton', () => {
    let successful: boolean;
    let failure: unknown;
    beforeEach(async () => {
        const broken = serviceToken<object>('broken');
        const server = new ArcServer({ services: [{ token: broken, lifetime: ServiceLifetime.Singleton,
            factory: () => { throw new Error('construction failed'); } }],
        commands: [defineCommand({ name: 'Fail', schema: z.object({}), handlerDependencies: [broken],
            handle: async () => { await currentServices().resolve(broken); return 'unexpected'; } })] });
        let work!: ReturnType<typeof server.executeCommand>;
        server.services.addShutdownParticipant({ stop: () => {}, drain: async () => { await work; } });
        try {
            work = server.executeCommand('Fail', {}, serviceContext('tenant'));
            const result = await beforeDeadline(work, 'failed participant-tracked command');
            successful = result.isSuccess;
            failure = await beforeDeadline(captureFailure(server.services.dispose()), 'failed command shutdown');
        } finally { await captureFailure(beforeDeadline(server.dispose(), 'failed command cleanup')); }
    });
    it('should settle the command and the participant drain without joining its own shutdown', () => {
        successful.should.equal(false);
        (failure === undefined).should.equal(true);
    });
});
