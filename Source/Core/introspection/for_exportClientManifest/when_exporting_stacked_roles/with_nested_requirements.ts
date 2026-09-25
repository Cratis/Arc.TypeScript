// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineCommand } from '../../../commands/defineCommand.js';
import { exportClientManifest } from '../../ClientManifest.js';

describe('when exporting nested role requirements to the client manifest', () => {
    let roles: readonly string[];
    beforeEach(async () => {
        const server = new ArcServer({ commands: [defineCommand({
            name: 'Protected', schema: z.object({}), handle: () => undefined,
            clientOutput: { output: { kind: 'void' } },
            authorization: { requirements: [
                { roles: ['Admin'] }, { requirements: [{ roles: ['Reader'] }, { roles: ['Auditor'] }] }
            ] }
        })] });
        try { roles = exportClientManifest(server).operations[0]!.roles; }
        finally { await server.dispose(); }
    });
    it('should retain roles from every nested declaration', () => { roles.should.deep.equal(['Admin', 'Auditor', 'Reader']); });
});
