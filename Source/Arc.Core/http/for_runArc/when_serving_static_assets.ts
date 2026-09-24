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

describe('when serving streamed static assets', () => {
    let responses: Record<string, Awaited<ReturnType<typeof exchange>>>;
    let cacheVariants: Awaited<ReturnType<typeof exchange>>[];
    let denied: number[];

    beforeEach(async () => {
        const directory = await mkdtemp(join(tmpdir(), 'arc-node-'));
        const root = join(directory, 'public');
        await mkdir(join(root, 'assets'), { recursive: true });
        await writeFile(join(root, 'index.html'), '<html>app</html>');
        await writeFile(join(root, 'assets', 'site.css'), 'body{}');
        await writeFile(join(root, 'assets', 'index.html'), '<html>assets</html>');
        await writeFile(join(root, '.secret'), 'hidden');
        await writeFile(join(directory, 'private.txt'), 'private');
        await symlink(join(directory, 'private.txt'), join(root, 'escape.txt'));
        const arc = new ArcServer({});
        const host = await runArc(arc, { port: 0, staticFiles: { root }, fallback: 'index.html' });
        const port = portOf(host.server);
        try {
            responses = {};
            responses.index = await exchange(port, '/');
            responses.redirect = await exchange(port, '/assets');
            responses.assets = await exchange(port, '/assets/');
            responses.css = await exchange(port, '/assets/site.css');
            responses.head = await exchange(port, '/assets/site.css', 'HEAD');
            responses.cached = await exchange(port, '/assets/site.css', 'GET', { 'if-none-match': String(responses.css.headers.etag) });
            cacheVariants = [];
            for (const tag of [`"other", ${responses.css.headers.etag}`, `W/${responses.css.headers.etag}`, '*'])
                cacheVariants.push(await exchange(port, '/assets/site.css', 'GET', { 'if-none-match': tag }));
            responses.precedence = await exchange(port, '/assets/site.css', 'GET', {
                'if-none-match': '"other"', 'if-modified-since': String(responses.css.headers['last-modified'])
            });
            responses.range = await exchange(port, '/assets/site.css', 'GET', { range: 'bytes=0-1' });
            responses.modified = await exchange(port, '/assets/site.css', 'GET', { 'if-modified-since': String(responses.css.headers['last-modified']) });
            responses.fallback = await exchange(port, '/dashboard/users', 'GET', { accept: 'text/html,application/xhtml+xml' });
            responses.fallbackHead = await exchange(port, '/dashboard/users', 'HEAD', { accept: 'text/html' });
            denied = [];
            for (const path of ['/dashboard/x.js', '/api/missing', '/.cratis/missing', '/missing.txt', '/escape.txt',
                '/.secret', '/%2e%2e/private.txt', '/%252e%252e/private.txt', '/assets/%5cprivate.txt', '/assets/%00site.css',
                '/assets/%2e%2e/private.txt', '/%61pi/missing', '/API/missing', '/assets//site.css', '/assets/%73ite.css',
                '/assets/site.css:payload', '/CON.txt', '/nul', '/.well-known/security.txt'])
                denied.push((await exchange(port, path, 'GET', { accept: 'text/html' })).status);
            denied.push((await exchange(port, '/dashboard', 'GET', { accept: 'application/json' })).status);
            denied.push((await exchange(port, '/dashboard', 'POST', { accept: 'text/html' })).status);
        } finally { await host.close(); await arc.dispose(); await rm(directory, { recursive: true, force: true }); }
    });

    it('should stream the index with an HTML content type', () => {
        responses.index?.body.should.equal('<html>app</html>');
        responses.index?.headers['content-type']?.should.equal('text/html; charset=utf-8');
    });
    it('should redirect directory requests', () => {
        responses.redirect?.status.should.equal(301);
        responses.redirect?.headers.location?.should.equal('/assets/');
        responses.assets?.body.should.equal('<html>assets</html>');
    });
    it('should serve CSS with its content type', () => { responses.css?.headers['content-type']?.should.equal('text/css; charset=utf-8'); });
    it('should serve HEAD without a body', () => {
        responses.head?.body.should.equal('');
        responses.head?.headers['content-length']?.should.equal('6');
    });
    it('should honor ETag validators', () => { responses.cached?.status.should.equal(304); });
    it('should honor list weak and wildcard validators without a body', () => {
        cacheVariants.every(value => value.status === 304 && value.body === '' && value.headers['x-content-type-options'] === 'nosniff').should.equal(true);
    });
    it('should give a mismatched ETag precedence over modified-since', () => { responses.precedence?.status.should.equal(200); });
    it('should not advertise ranges or serve partial content', () => {
        responses.css?.headers['accept-ranges']?.should.equal('none');
        responses.range?.status.should.equal(200);
    });
    it('should honor a modified-since validator', () => { responses.modified?.status.should.equal(304); });
    it('should serve navigation fallback without caching', () => {
        responses.fallback?.body.should.equal(responses.index?.body);
        responses.fallback?.headers['cache-control']?.should.equal('no-cache');
        responses.index?.headers['cache-control']?.should.equal('no-cache');
        responses.index?.headers['x-content-type-options']?.should.equal('nosniff');
        responses.fallbackHead?.status.should.equal(200);
    });
    it('should reject hidden, traversing, disguised and API paths', () => { denied.every(status => status === 404).should.equal(true); });
});
