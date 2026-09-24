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
import { cert, key } from '../../specs/tls-fixture.js';

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
async function eventually(predicate: () => boolean): Promise<void> {
    const deadline = Date.now() + 2000;
    while (!predicate()) {
        if (Date.now() > deadline) throw Error('Condition did not become true');
        await new Promise(resolve => setTimeout(resolve, 5));
    }
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
            for (const path of ['/app/api/%65cho', '/app/API/echo', '/app/api//echo', '/app/%61pi/missing',
                '/app/API/missing', '/app/.CRATIS/missing']) {
                const denied = await exchange(port, path, 'GET', { accept: 'text/html' });
                denied.status.should.equal(404);
                denied.body.should.equal('Not Found');
            }
            (await exchange(port, '/APP/api/echo', 'POST', {}, '{"value":"b"}')).status.should.equal(200);
            calls.should.equal(2);
            (await exchange(port, '/app/api/echo', 'TRACE')).status.should.equal(405);
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
            const redirect = await exchange(port, '/assets');
            redirect.status.should.equal(301);
            redirect.headers.location!.should.equal('/assets/');
            (await exchange(port, '/assets/')).body.should.equal('<html>assets</html>');
            const css = await exchange(port, '/assets/site.css');
            css.headers['content-type']!.should.equal('text/css; charset=utf-8');
            (await exchange(port, '/assets/site.css', 'HEAD')).body.should.equal('');
            (await exchange(port, '/assets/site.css', 'HEAD')).headers['content-length']!.should.equal('6');
            (await exchange(port, '/assets/site.css', 'GET', { 'if-none-match': String(css.headers.etag) })).status.should.equal(304);
            for (const tag of [`"other", ${css.headers.etag}`, `W/${css.headers.etag}`, '*']) {
                const cached = await exchange(port, '/assets/site.css', 'GET', { 'if-none-match': tag });
                cached.status.should.equal(304);
                cached.body.should.equal('');
                cached.headers['x-content-type-options']!.should.equal('nosniff');
            }
            (await exchange(port, '/assets/site.css', 'GET', { 'if-none-match': '"other"', 'if-modified-since': String(css.headers['last-modified']) })).status.should.equal(200);
            css.headers['accept-ranges']!.should.equal('none');
            (await exchange(port, '/assets/site.css', 'GET', { range: 'bytes=0-1' })).status.should.equal(200);
            (await exchange(port, '/assets/site.css', 'GET', { 'if-modified-since': String(css.headers['last-modified']) })).status.should.equal(304);
            const fallback = await exchange(port, '/dashboard/users', 'GET', { accept: 'text/html,application/xhtml+xml' });
            fallback.body.should.equal(index.body);
            fallback.headers['cache-control']!.should.equal('no-cache');
            index.headers['cache-control']!.should.equal('no-cache');
            index.headers['x-content-type-options']!.should.equal('nosniff');
            (await exchange(port, '/dashboard/users', 'HEAD', { accept: 'text/html' })).status.should.equal(200);
            for (const path of ['/dashboard/x.js', '/api/missing', '/.cratis/missing', '/missing.txt', '/escape.txt',
                '/.secret', '/%2e%2e/private.txt', '/%252e%252e/private.txt', '/assets/%5cprivate.txt', '/assets/%00site.css',
                '/assets/%2e%2e/private.txt', '/%61pi/missing', '/API/missing', '/assets//site.css', '/assets/%73ite.css',
                '/assets/site.css:payload', '/CON.txt', '/nul', '/.well-known/security.txt'])
                (await exchange(port, path, 'GET', { accept: 'text/html' })).status.should.equal(404);
            (await exchange(port, '/dashboard', 'GET', { accept: 'application/json' })).status.should.equal(404);
            (await exchange(port, '/dashboard', 'POST', { accept: 'text/html' })).status.should.equal(404);
        } finally { await host.close(); await arc.dispose(); await rm(directory, { recursive: true, force: true }); }
    });

    it('serves only explicitly allowed well-known files, safe symlinks, and configured MIME types', async () => {
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
            (await exchange(port, '/.well-known/security.txt')).body.should.equal('Contact: support');
            (await exchange(port, '/.well-known/other.txt')).status.should.equal(404);
            (await exchange(port, '/indirect.txt')).status.should.equal(404);
            (await exchange(port, '/out/secret.txt')).status.should.equal(404);
            (await exchange(port, '/loop/')).status.should.equal(404);
            (await exchange(port, '/custom.xme')).headers['content-type']!.should.equal('application/x-example');
        } finally { await host.close(); await arc.dispose(); await rm(directory, { recursive: true, force: true }); }
    });

    it('releases a streamed file handle after the client disconnects mid-transfer', async () => {
        const root = await mkdtemp(join(tmpdir(), 'arc-node-'));
        await writeFile(join(root, 'large.bin'), Buffer.alloc(16 * 1024 * 1024, 97));
        const arc = new ArcServer({});
        const host = await runArc(arc, { port: 0, staticFiles: { root } });
        const socket = connect(portOf(host.server), '127.0.0.1');
        try {
            let bytes = 0;
            const first = new Promise<void>(resolve => {
                socket.once('connect', () => socket.write('GET /large.bin HTTP/1.1\r\nHost: localhost\r\n\r\n'));
                socket.once('data', chunk => { bytes += chunk.length; socket.destroy(); resolve(); });
            });
            await first;
            (bytes < 16 * 1024 * 1024).should.equal(true);
            await eventually(() => socket.destroyed);
            (await exchange(portOf(host.server), '/large.bin', 'HEAD')).status.should.equal(200);
        } finally { socket.destroy(); await host.close(); await arc.dispose(); await rm(root, { recursive: true, force: true }); }
    });

    it('does not recurse through a default-document symlink to its own directory', async () => {
        const root = await mkdtemp(join(tmpdir(), 'arc-node-'));
        await symlink('.', join(root, 'index.html'));
        const arc = new ArcServer({});
        const host = await runArc(arc, { port: 0, staticFiles: { root } });
        try { (await exchange(portOf(host.server), '/')).status.should.equal(404); }
        finally { await host.close(); await arc.dispose(); await rm(root, { recursive: true, force: true }); }
    });

    it('rejects missing static roots and invalid public-file options at startup', async () => {
        const root = join(tmpdir(), `missing-arc-node-${process.pid}-${Date.now()}`);
        const arc = new ArcServer({});
        let rejected = false;
        try { await runArc(arc, { port: 0, staticFiles: { root } }); }
        catch { rejected = true; }
        rejected.should.equal(true);
        for (const wellKnown of ['.well-known/../config', '.well-known/.secret', 'anything']) {
            (() => createArcNodeHandler(arc, { staticFiles: { root: '/tmp', wellKnown: [wellKnown] } })).should.throw();
        }
        await arc.dispose();
    });

    it('logs listener and handler errors without crashing, and supports a caller-owned listener', async () => {
        const errors: unknown[] = [];
        const arc = new ArcServer({ logger: error => { errors.push(error); },
            queries: [defineQuery({ name: 'Ping', schema: z.object({}), perform: () => 'pong' })] });
        const host = await runArc(arc, { port: 0, native: () => { throw Error('native failed'); } });
        const owned = createServer(createArcNodeHandler(arc));
        await new Promise<void>(resolve => owned.listen(0, '127.0.0.1', resolve));
        try {
            host.server.emit('error', Error('accept failed'));
            errors.some(error => error instanceof Error && error.message === 'accept failed').should.equal(true);
            (await exchange(portOf(host.server), '/api/ping')).status.should.equal(500);
            errors.some(error => error instanceof Error && error.message === 'native failed').should.equal(true);
            (await exchange(portOf(owned), '/api/ping')).status.should.equal(200);
            (await exchange(portOf(owned), '/api/ping', 'TRACE')).status.should.equal(405);
            const connection = connect(portOf(host.server), '127.0.0.1');
            try {
                const status = await new Promise<string>((resolve, reject) => {
                    connection.once('connect', () => connection.write('CONNECT /api/ping HTTP/1.1\r\nHost: localhost\r\n\r\n'));
                    connection.once('data', chunk => resolve(String(chunk).split('\r\n')[0]!));
                    connection.once('error', reject);
                });
                status.should.equal('HTTP/1.1 405 Method Not Allowed');
            } finally { connection.destroy(); }
        } finally {
            await host.close();
            await new Promise<void>((resolve, reject) => owned.close(error => error ? reject(error) : resolve()));
            await arc.dispose();
        }
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
            await new Promise(resolve => setTimeout(resolve, 25));
            finished.should.equal(false);
            release('finished');
            JSON.parse((await pending).body).data.should.equal('finished');
            await closing;
            finished.should.equal(true);
            arc.services.disposed.should.equal(false);
        } finally { await arc.dispose(); }
    });

    it('streams SSE frames and destroys the subscription on host close', async () => {
        const values = new CurrentValueSubject<number[]>({ hasValue: true, value: [1] });
        let observers = 0;
        const source = { current: () => values.current(), subscribe: (observer: Parameters<typeof values.subscribe>[0]) => {
            observers++;
            const subscription = values.subscribe(observer);
            return { unsubscribe: () => { observers--; subscription.unsubscribe(); } };
        } };
        const arc = new ArcServer({ observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}), observe: () => source })] });
        const host = await runArc(arc, { port: 0 });
        try {
            const response = await fetch(`http://127.0.0.1:${portOf(host.server)}/api/numbers`, { headers: { accept: 'text/event-stream' } });
            response.headers.get('content-type')!.should.contain('text/event-stream');
            const reader = response.body!.getReader();
            const first = await reader.read();
            new TextDecoder().decode(first.value).should.contain('"data":[1]');
            values.next([2]);
            const second = await reader.read();
            new TextDecoder().decode(second.value).should.contain('"data":[2]');
            observers.should.equal(1);
            await host.close({ timeoutMs: 500 });
            await reader.read().catch(() => undefined);
            await eventually(() => observers === 0);
        } finally { await host.close(); await arc.dispose(); }
    });

    it('closes an SSE response registered after shutdown starts', async () => {
        let release!: () => void;
        let entered!: () => void;
        const ready = new Promise<void>(resolve => { entered = resolve; });
        const gate = new Promise<void>(resolve => { release = resolve; });
        const values = new CurrentValueSubject<number[]>({ hasValue: true, value: [1] });
        const arc = new ArcServer({ resolveTenant: async () => { entered(); await gate; return undefined; },
            observableQueries: [defineObservableQuery({ name: 'Numbers', schema: z.object({}), observe: () => values })] });
        const host = await runArc(arc, { port: 0 });
        const socket = connect(portOf(host.server), '127.0.0.1');
        socket.resume();
        try {
            socket.on('connect', () => socket.write('GET /api/numbers HTTP/1.1\r\nHost: localhost\r\nAccept: text/event-stream\r\n\r\n'));
            await ready;
            let finished = false;
            const started = Date.now();
            const closing = host.close({ timeoutMs: 2000 }).then(() => { finished = true; });
            await new Promise(resolve => setTimeout(resolve, 20));
            finished.should.equal(false);
            release();
            await closing;
            finished.should.equal(true);
            (Date.now() - started < 1000).should.equal(true);
            await eventually(() => socket.destroyed);
        } finally { release(); socket.destroy(); await host.close(); await arc.dispose(); }
    });

    it('bounds shutdown for a slow ordinary request', async () => {
        let entered!: () => void;
        const ready = new Promise<void>(resolve => { entered = resolve; });
        const arc = new ArcServer({ queries: [defineQuery({ name: 'Wait', schema: z.object({}), perform: (_input, context) => {
            entered();
            return new Promise<string>(resolve => context.signal.addEventListener('abort', () => resolve('done'), { once: true }));
        } })] });
        const host = await runArc(arc, { port: 0 });
        const socket = connect(portOf(host.server), '127.0.0.1');
        try {
            socket.on('connect', () => socket.write('GET /api/wait HTTP/1.1\r\nHost: localhost\r\n\r\n'));
            await ready;
            await host.close({ timeoutMs: 25 });
            await eventually(() => socket.destroyed);
        } finally { socket.destroy(); await host.close(); await arc.dispose(); }
    });
});
