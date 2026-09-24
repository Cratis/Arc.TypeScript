// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcServer } from '../../../ArcServer.js';
import { ObservableLimits } from '../../observable/ObservableLimits.js';
import { ObservableSessions } from '../../ObservableSessions.js';

should();

describe('when recording repeated cleanup failures', () => {
    let sessions: ObservableSessions;
    let server: ArcServer;
    let firstRecorded: boolean;
    let secondRecorded: boolean;

    beforeEach(() => {
        server = new ArcServer({});
        sessions = new ObservableSessions({}, server.services, new ObservableLimits({}), () => []);
        const session = {};
        firstRecorded = sessions.recordCleanupFailure(session, Error('first'));
        secondRecorded = sessions.recordCleanupFailure(session, Error('again'));
        for (let index = 0; index < 100; index++) sessions.recordCleanupFailure({}, Error(`failure ${index}`));
    });

    afterEach(async () => { await server.dispose(); });

    it('should count one failure per session', () => {
        should().equal(firstRecorded, true);
        should().equal(secondRecorded, false);
        should().equal(sessions.cleanupFailureCount, 101);
    });

    it('should keep only a bounded sample of errors', () => {
        should().equal(sessions.cleanupFailures.length, 16);
    });
});
