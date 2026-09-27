// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { beforeDeadline, gate } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

should();
describe('when a participant registers during observable teardown', () => {
    let events: string[];
    beforeEach(async () => {
        events = [];
        const entered = gate(); const release = gate();
        const server = new ArcServer({});
        server.closeWebSockets = async () => { entered.release(); await release.promise; events.push('websockets closed'); };
        try {
            const closing = server.dispose();
            await beforeDeadline(entered.promise, 'transport teardown entry');
            server.services.addShutdownParticipant({ stop: () => { events.push('stop'); },
                drain: async () => { events.push('drain'); } });
            release.release();
            await beforeDeadline(closing, 'transport teardown shutdown');
        } finally { release.release(); }
    });
    it('should finish the shared observable cleanup without joining its own shutdown', () => {
        events.should.deep.equal(['websockets closed', 'stop', 'drain']);
    });
});
