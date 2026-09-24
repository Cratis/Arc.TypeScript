// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineCommand } from '../../../commands/defineCommand.js';
import { exportClientManifest } from '../../ClientManifest.js';

describe('when exporting stacked policies without role requirements', () => {
    let authentication: string;
    beforeEach(async () => {
        const server = new ArcServer({ authorizationPolicies: { A: () => true, B: () => true },
            commands: [defineCommand({ name: 'Protected', schema: z.object({}), handle: () => undefined,
                clientOutput: { output: { kind: 'void' } },
                authorization: { requirements: [{ policy: 'A' }, { policy: 'B' }] } })] });
        try { authentication = exportClientManifest(server).operations[0]!.authentication; }
        finally { await server.dispose(); }
    });
    it('should mark the command authenticated', () => { authentication.should.equal('authenticated'); });
});
