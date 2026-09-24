// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { runArc } from '../runArc.js';
import { exchange, portOf } from './given/a_node_host.js';

should();

describe('when serving Arc with a path base and static fallback', () => {
    let responses: Record<string, { status: number; body: string }>;
    let bypasses: number[];
    let reserved: { status: number; body: string }[];
    let callsBeforeCase: number;
    let callsAfterCase: number;

    beforeEach(async () => {
        const root = await mkdtemp(join(tmpdir(), 'arc-node-'));
        await mkdir(join(root, 'api'));
        await writeFile(join(root, 'api', 'echo'), 'SHADOW');
        await writeFile(join(root, 'index.html'), '<html>base</html>');
        let calls = 0;
        const arc = new ArcServer({ maxBodyBytes: 16, commands: [defineCommand({
            name: 'Echo', schema: z.object({ value: z.string() }), handle: ({ value }) => { calls++; return value; }
        })] });
        const host = await runArc(arc, { port: 0, pathBase: '/app', staticFiles: { root }, fallback: 'index.html' });
        const port = portOf(host.server);
        try {
            responses = {};
            const requests: [string, string, string, Record<string, string>?, string?][] = [
                ['ok', '/app/api/echo', 'POST', {}, '{"value":"a"}'],
                ['oversize', '/app/api/echo', 'POST', {}, '{"value":"too long"}'],
                ['chunked', '/app/api/echo', 'POST', { 'transfer-encoding': 'chunked' }, '{"value":"too long"}'],
                ['put', '/app/api/echo', 'PUT'], ['get', '/app/api/echo', 'GET'],
                ['commands', '/app/.cratis/commands', 'GET'], ['commandsPost', '/app/.cratis/commands', 'POST'],
                ['root', '/app/', 'GET'], ['dashboard', '/app/dashboard', 'GET', { accept: 'text/html' }],
                ['application', '/application/api/echo', 'GET'], ['outside', '/api/echo', 'GET'],
                ['trace', '/app/api/echo', 'TRACE'], ['unknown', '/app/unknown', 'GET']
            ];
            for (const [name, path, method, headers, payload] of requests)
                responses[name] = await exchange(port, path, method, headers, payload);
            bypasses = [];
            for (const path of ['//app/api/echo', '/app/x/../api/echo', '/app/%2e%2e/app/api/echo', 'http://attacker.invalid/app/api/echo'])
                bypasses.push((await exchange(port, path, 'POST', {}, '{}')).status);
            callsBeforeCase = calls;
            reserved = [];
            for (const path of ['/app/api/%65cho', '/app/API/echo', '/app/api//echo', '/app/%61pi/missing',
                '/app/API/missing', '/app/.CRATIS/missing'])
                reserved.push(await exchange(port, path, 'GET', { accept: 'text/html' }));
            responses.case = await exchange(port, '/APP/api/echo', 'POST', {}, '{"value":"b"}');
            callsAfterCase = calls;
        } finally { await host.close(); await arc.dispose(); await rm(root, { recursive: true, force: true }); }
    });

    it('should prioritize the Arc command over shadowing files', () => {
        responses.ok?.status.should.equal(200);
        JSON.parse(responses.ok!.body).response.should.equal('a');
    });
    it('should reject oversized raw and chunked bodies', () => {
        responses.oversize?.status.should.equal(400);
        responses.chunked?.status.should.equal(400);
    });
    it('should enforce command method ownership', () => {
        responses.put?.status.should.equal(405);
        responses.get?.status.should.equal(405);
        responses.trace?.status.should.equal(405);
    });
    it('should enforce introspection method ownership', () => {
        responses.commands?.status.should.equal(200);
        responses.commandsPost?.status.should.equal(405);
    });
    it('should serve static default and navigation fallback', () => {
        responses.root?.body.should.equal('<html>base</html>');
        responses.dashboard?.body.should.equal('<html>base</html>');
    });
    it('should not serve outside the path base', () => {
        responses.application?.status.should.equal(404);
        responses.outside?.status.should.equal(404);
    });
    it('should reject normalized path bypasses', () => { bypasses.every(status => status === 404).should.equal(true); });
    it('should not execute rejected requests', () => { callsBeforeCase.should.equal(1); });
    it('should not serve fallback for disguised API routes', () => {
        reserved.every(value => value.status === 404 && value.body === 'Not Found').should.equal(true);
    });
    it('should match the path base case-insensitively', () => { responses.case?.status.should.equal(200); });
    it('should execute the case-insensitive request once', () => { callsAfterCase.should.equal(2); });
    it('should return Not Found for an unknown route', () => { responses.unknown?.body.should.equal('Not Found'); });
});
