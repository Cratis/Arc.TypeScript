// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { exportClientManifest } from '../../introspection/ClientManifest.js';
import type { ClientManifest } from '../../introspection/ClientManifest.js';

// Metadata export must still describe real operations, not just return an empty document.
describe('when exporting in-process metadata with HTTP discovery disabled', () => {
    let document: ReturnType<ArcServer['openApi']>;
    let manifest: ClientManifest;
    beforeEach(async () => {
        const server = new ArcServer({ environmentName: 'Development', introspection: { enabled: false },
            commands: [defineCommand({ name: 'Submit', schema: z.object({ value: z.string() }), handle: () => undefined,
                clientOutput: { output: { kind: 'void' } } })],
            queries: [defineQuery({ name: 'Find', schema: z.object({}), perform: () => ['ready'],
                clientOutput: { output: { kind: 'array', element: { kind: 'string' } } } })] });
        try { document = server.openApi(); manifest = exportClientManifest(server); }
        finally { await server.dispose(); }
    });
    it('should include the command and query in OpenAPI', () => Object.keys(document.paths as Record<string, unknown>).should.include.members(['/api/submit', '/api/find']));
    it('should include the command and query in the client manifest', () => manifest.operations.map(operation => operation.route).should.have.members(['/api/submit', '/api/find']));
});
