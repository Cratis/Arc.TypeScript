// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { mkdtemp, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ArcServer } from '../../ArcServer.js';
import { runArc } from '../runArc.js';
import { exchange, portOf } from './given/a_node_host.js';

should();

describe('when serving explicitly allowed public files', () => {
    let allowed: string;
    let denied: number[];
    let mime: string | string[] | undefined;

    beforeEach(async () => {
        const directory = await mkdtemp(join(tmpdir(), 'arc-node-'));
        const root = join(directory, 'public');
        await mkdir(join(root, '.well-known'), { recursive: true });
        await mkdir(join(directory, 'outside'));
        await writeFile(join(root, '.secret'), 'PRIVATE');
        await writeFile(join(root, '.well-known', 'security.txt'), 'Contact: support');
        await writeFile(join(root, '.well-known', 'other.txt'), 'NO');
        await writeFile(join(root, 'custom.xme'), 'custom');
        await writeFile(join(directory, 'outside', 'secret.txt'), 'OUTSIDE');
        await symlink(join(root, '.secret'), join(root, 'indirect.txt'));
        await symlink(join(directory, 'outside'), join(root, 'out'));
        await symlink(root, join(root, 'loop'));
        const arc = new ArcServer({});
        const host = await runArc(arc, { port: 0, staticFiles: {
            root, wellKnown: ['.well-known/security.txt'], contentTypes: { '.xme': 'application/x-example' }
        } });
        try {
            const port = portOf(host.server);
            allowed = (await exchange(port, '/.well-known/security.txt')).body;
            denied = [];
            for (const path of ['/.well-known/other.txt', '/indirect.txt', '/out/secret.txt', '/loop/'])
                denied.push((await exchange(port, path)).status);
            mime = (await exchange(port, '/custom.xme')).headers['content-type'];
        } finally { await host.close(); await arc.dispose(); await rm(directory, { recursive: true, force: true }); }
    });

    it('should serve an explicitly allowed well-known file', () => { allowed.should.equal('Contact: support'); });
    it('should reject other well-known files and symlinks', () => { denied.every(status => status === 404).should.equal(true); });
    it('should serve a configured MIME type', () => { mime?.should.equal('application/x-example'); });
});
