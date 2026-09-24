// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArcServer } from '../../ArcServer.js';
import { runArc } from '../runArc.js';
import { exchange, portOf } from './given/a_node_host.js';

should();

describe('when the static default document is a symlink loop', () => {
    let status: number;

    beforeEach(async () => {
        const root = await mkdtemp(join(tmpdir(), 'arc-node-'));
        await symlink('.', join(root, 'index.html'));
        const arc = new ArcServer({});
        const host = await runArc(arc, { port: 0, staticFiles: { root } });
        try { status = (await exchange(portOf(host.server), '/')).status; }
        finally { await host.close(); await arc.dispose(); await rm(root, { recursive: true, force: true }); }
    });

    it('should not recurse into the directory', () => { status.should.equal(404); });
});
