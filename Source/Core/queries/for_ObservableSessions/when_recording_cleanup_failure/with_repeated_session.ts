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
        sessions = new ObservableSessions({}, server.services, new ObservableLimits({}), () => new Map());
        const session = {};
        firstRecorded = sessions.recordCleanupFailure(session);
        secondRecorded = sessions.recordCleanupFailure(session);
    });

    afterEach(async () => { await server.dispose(); });

    it('should record a failure only once per session', () => {
        should().equal(firstRecorded, true);
        should().equal(secondRecorded, false);
    });
});
