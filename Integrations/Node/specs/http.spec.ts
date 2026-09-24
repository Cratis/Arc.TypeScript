// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { createServer, request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect } from 'node:net';
import { mkdtemp, rm, symlink, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { ArcServer, CurrentValueSubject, defineCommand, defineObservableQuery, defineQuery } from '@cratis/arc.server';
import { createArcNodeHandler, runArc } from '../src/index.js';
import { cert, key } from '../../Express/specs/tls-fixture.js';

should();
async function exchange(port: number, path: string, method = 'GET', headers: Record<string, string> = {}, payload?: string, secure = false) {
    return new Promise<{ status: number; headers: import('node:http').IncomingHttpHeaders; body: string }>((resolve, reject) => {
        const req = (secure ? httpsRequest : httpRequest)({ host: '127.0.0.1', port, path, method, headers, rejectUnauthorized: false }, res => {
            const chunks: Buffer[] = [];
            res.on('data', chunk => chunks.push(Buffer.from(chunk)));
            res.on('end', () => resolve({ status: res.statusCode!, headers: res.headers, body: Buffer.concat(chunks).toString() }));
        });
        req.on('error', reject);
        req.end(payload);
    });
}
function portOf(listener: ReturnType<typeof createServer>): number {
    const address = listener.address();
    if (!address || typeof address === 'string') throw Error('No port');
    return address.port;
}

it('validates path base, default documents and fallback paths before accepting requests', () => {
    const arc = new ArcServer({});
    for (const pathBase of ['api', '/', '/x/', '/x/../y', '//api'])
        (() => createArcNodeHandler(arc, { pathBase })).should.throw();
    (() => createArcNodeHandler(arc, { fallback: 'index.html' })).should.throw();
    for (const fallback of ['../secret', '/etc/passwd', '.env', 'a/../index.html', 'a\\b'])
        (() => createArcNodeHandler(arc, { staticFiles: { root: '/tmp' }, fallback })).should.throw();
});

describe('standalone real HTTP sockets', () => {
    it('prioritizes Arc, honors path base and method ownership, caps raw bodies, and rejects normalized bypasses', async () => {
        const root = await mkdtemp(join(tmpdir(), 'arc-node-'));
        await mkdir(join(root, 'api'));
        await writeFile(join(root, 'api', 'echo'), 'SHADOW');
        await writeFile(join(root, 'index.html'), '<html>base</html>');
        let calls = 0;
        const arc = new ArcServer({ maxBodyBytes: 16, commands: [defineCommand({ name: 'Echo', schema: z.object({ value: z.string() }), handle: ({ value }) => { calls++; return value; } })] });
        const host = await runArc(arc, { port: 0, pathBase: '/app', staticFiles: { root }, fallback: 'index.html' });
        const port = portOf(host.server);
        try {
            const ok = await exchange(port, '/app/api/echo', 'POST', {}, '{"value":"a"}');
            ok.status.should.equal(200);
            JSON.parse(ok.body).response.should.equal('a');
            (await exchange(port, '/app/api/echo', 'POST', {}, '{"value":"too long"}')).status.should.equal(400);
            (await exchange(port, '/app/api/echo', 'POST', { 'transfer-encoding': 'chunked' }, '{"value":"too long"}')).status.should.equal(400);
            (await exchange(port, '/app/api/echo', 'PUT')).status.should.equal(405);
            (await exchange(port, '/app/api/echo')).status.should.equal(405);
            (await exchange(port, '/app/.cratis/commands')).status.should.equal(200);
            (await exchange(port, '/app/.cratis/commands', 'POST')).status.should.equal(405);
            (await exchange(port, '/app/')).body.should.equal('<html>base</html>');
            (await exchange(port, '/app/dashboard', 'GET', { accept: 'text/html' })).body.should.equal('<html>base</html>');
            (await exchange(port, '/application/api/echo')).status.should.equal(404);
            (await exchange(port, '/api/echo')).status.should.equal(404);
            for (const path of ['//app/api/echo', '/app/x/../api/echo', '/app/%2e%2e/app/api/echo', 'http://attacker.invalid/app/api/echo'])
                (await exchange(port, path, 'POST', {}, '{}')).status.should.equal(404);
            calls.should.equal(1);
            (await exchange(port, '/app/unknown')).body.should.equal('Not Found');
        } finally { await host.close(); await arc.dispose(); await rm(root, { recursive: true, force: true }); }
    });

    it('serves streamed static assets, HEAD and validators but never leaks files or sends fallback for API paths', async () => {
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
            const index = await exchange(port, '/');
            index.body.should.equal('<html>app</html>');
            index.headers['content-type']!.should.equal('text/html; charset=utf-8');
            (await exchange(port, '/assets')).body.should.equal('<html>assets</html>');
            const css = await exchange(port, '/assets/site.css');
            css.headers['content-type']!.should.equal('text/css; charset=utf-8');
            (await exchange(port, '/assets/site.css', 'HEAD')).body.should.equal('');
            (await exchange(port, '/assets/site.css', 'HEAD')).headers['content-length']!.should.equal('6');
            (await exchange(port, '/assets/site.css', 'GET', { 'if-none-match': String(css.headers.etag) })).status.should.equal(304);
            (await exchange(port, '/assets/site.css', 'GET', { 'if-modified-since': String(css.headers['last-modified']) })).status.should.equal(304);
            (await exchange(port, '/dashboard/users', 'GET', { accept: 'text/html,application/xhtml+xml' })).body.should.equal(index.body);
            (await exchange(port, '/dashboard/users', 'HEAD', { accept: 'text/html' })).status.should.equal(200);
            for (const path of ['/dashboard/x.js', '/api/missing', '/.cratis/missing', '/missing.txt', '/escape.txt', '/.secret', '/%2e%2e/private.txt', '/%252e%252e/private.txt', '/assets/%5cprivate.txt', '/assets/%00site.css', '/assets/%2e%2e/private.txt'])
                (await exchange(port, path, 'GET', { accept: 'text/html' })).status.should.equal(404);
            (await exchange(port, '/dashboard', 'GET', { accept: 'application/json' })).status.should.equal(404);
            (await exchange(port, '/dashboard', 'POST', { accept: 'text/html' })).status.should.equal(404);
        } finally { await host.close(); await arc.dispose(); await rm(directory, { recursive: true, force: true }); }
    });

    it('passes trusted TLS and native principal, not forwarded headers', async () => {
        const arc = new ArcServer({ nativePrincipal: true, identityDetails: { schema: z.object({}), provide: () => ({}) } });
        const plain = await runArc(arc, { port: 0, native: () => ({ principal: { id: 'host', roles: [], isAuthenticated: true } }) });
        const tls = await runArc(arc, { port: 0, https: { cert, key }, native: () => ({ principal: { id: 'host', roles: [], isAuthenticated: true } }) });
        try {
            const http = await exchange(portOf(plain.server), '/.cratis/me', 'GET', { 'x-forwarded-proto': 'https' });
            http.status.should.equal(200);
            String(http.headers['set-cookie']).should.not.contain('Secure');
            const https = await exchange(portOf(tls.server), '/.cratis/me', 'GET', { 'x-forwarded-proto': 'http' }, undefined, true);
            https.status.should.equal(200);
            String(https.headers['set-cookie']).should.contain('Secure');
        } finally { await plain.close(); await tls.close(); await arc.dispose(); }
    });

    it('aborts a query on client disconnect', async () => {
        let started!: () => void;
        let aborted!: () => void;
        const ready = new Promise<void>(resolve => { started = resolve; });
        const canceled = new Promise<void>(resolve => { aborted = resolve; });
        const arc = new ArcServer({ queries: [defineQuery({ name: 'Wait', schema: z.object({}), perform: (_input, context) => new Promise(resolve => {
            context.signal.addEventListener('abort', () => { aborted(); resolve('done'); }, { once: true });
            started();
        }) })] });
        const host = await runArc(arc, { port: 0 });
        const socket = connect(portOf(host.server), '127.0.0.1');
        try {
            socket.on('connect', () => socket.write('GET /api/wait HTTP/1.1\r\nHost: localhost\r\n\r\n'));
            await ready;
            socket.destroy();
            await Promise.race([canceled, new Promise<never>((_resolve, reject) => setTimeout(() => reject(Error('Did not cancel')), 2000))]);
        } finally { socket.destroy(); await host.close(); await arc.dispose(); }
    });

    it('drains ordinary requests on close without disposing caller-owned Arc', async () => {
        let release!: (value: string) => void;
        let started!: () => void;
        const ready = new Promise<void>(resolve => { started = resolve; });
        const arc = new ArcServer({ queries: [defineQuery({ name: 'Wait', schema: z.object({}), perform: () => {
            started();
            return new Promise<string>(resolve => { release = resolve; });
        } })] });
        const host = await runArc(arc, { port: 0 });
        const pending = exchange(portOf(host.server), '/api/wait', 'GET', { connection: 'close' });
        try {
            await ready;
            let finished = false;
            const closing = host.close().then(() => { finished = true; });
            await Promise.resolve();
            finished.should.equal(false);
            release('finished');
            JSON.parse((await pending).body).data.should.equal('finished');
            await closing;
            finished.should.equal(true);
            arc.services.disposed.should.equal(false);
        } finally { await arc.dispose(); }
    });

    it('streams SSE frames and cancels subscriptions on close', async () => {
        const values = new CurrentValueSubject<number[]>({ hasValue: true, value: [1] });
        const arc = new ArcServer({ observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}), observe: () => values })] });
        const host = await runArc(arc, { port: 0 });
        try {
            const controller = new AbortController();
            const response = await fetch(`http://127.0.0.1:${portOf(host.server)}/api/numbers`, { headers: { accept: 'text/event-stream' }, signal: controller.signal });
            response.headers.get('content-type')!.should.contain('text/event-stream');
            const reader = response.body!.getReader();
            const first = await reader.read();
            new TextDecoder().decode(first.value).should.contain('"data":[1]');
            values.next([2]);
            const second = await reader.read();
            new TextDecoder().decode(second.value).should.contain('"data":[2]');
            controller.abort();
        } finally { await host.close(); await arc.dispose(); }
    });
});
