// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { createReadStream } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer, type ServerOptions as HttpsOptions } from 'node:https';
import { extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { TLSSocket } from 'node:tls';
import type { ArcServer, NativeRequestContext } from '@cratis/arc.server';

const origin = 'http://arc.invalid';
const types: Record<string, string> = {
    '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.map': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
    '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
    '.ttf': 'font/ttf', '.otf': 'font/otf', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json',
    '.pdf': 'application/pdf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4'
};

export interface ArcNodeOptions {
    /** Exact URL path prefix, without a trailing slash. */
    pathBase?: string;
    /** Public directory; relative paths resolve from process.cwd(). Disabled when omitted. */
    staticFiles?: { root: string; defaultDocument?: string };
    /** File within staticFiles.root used for extensionless HTML navigation requests. */
    fallback?: string;
    /** Only server-verified metadata; never derive principal or authority from HTTP headers. */
    native?: (request: IncomingMessage) => Omit<NativeRequestContext, 'secure'>;
}

export interface ArcNodeRunOptions extends ArcNodeOptions {
    port?: number;
    host?: string;
    https?: HttpsOptions;
}

function safeSegments(path: string): string[] | undefined {
    if (!path.startsWith('/') || path.startsWith('//')) return undefined;
    const segments: string[] = [];
    for (const part of path.split('/').slice(1)) {
        let decoded: string;
        try { decoded = decodeURIComponent(part); } catch { return undefined; }
        if (decoded === '.' || decoded === '..' || decoded.startsWith('.') || /[\\/\0%]/.test(decoded)) return undefined;
        if (decoded) segments.push(decoded);
    }
    return segments;
}

function validateOptions(options: ArcNodeOptions): void {
    const base = options.pathBase ?? '';
    if (base && (!/^\/(?:[a-zA-Z0-9_-]+)(?:\/[a-zA-Z0-9_-]+)*$/.test(base))) throw Error('Invalid Arc path base');
    if (options.fallback && !options.staticFiles) throw Error('SPA fallback requires static files');
    if (options.staticFiles && (!options.staticFiles.root || !safeFile(options.staticFiles.defaultDocument ?? 'index.html'))) throw Error('Invalid static file options');
    if (options.fallback && !safeFile(options.fallback)) throw Error('Invalid SPA fallback file');
}
function safeFile(path: string): boolean {
    const segments = safeSegments('/' + path);
    return !isAbsolute(path) && !!segments?.length && segments.join('/') === path;
}
function contained(root: string, target: string): boolean {
    const path = relative(root, target);
    return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}
function notFound(response: ServerResponse): void {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Not Found');
}

async function file(request: IncomingMessage, response: ServerResponse, root: string, segments: string[], defaultDocument?: string): Promise<boolean> {
    const base = await realpath(root).catch(() => undefined);
    if (!base) return false;
    const target = resolve(base, ...segments);
    if (!contained(base, target)) return false;
    const actual = await realpath(target).catch(() => undefined);
    if (!actual || !contained(base, actual)) return false;
    const info = await stat(actual).catch(() => undefined);
    if (info?.isDirectory() && defaultDocument) return file(request, response, root, [...segments, defaultDocument]);
    if (!info?.isFile()) return false;
    const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
    const headers = {
        'content-type': types[extname(actual).toLowerCase()] ?? 'application/octet-stream',
        'content-length': info.size, etag, 'last-modified': info.mtime.toUTCString()
    };
    const modified = request.headers['if-modified-since'];
    if (request.headers['if-none-match'] === etag || (!request.headers['if-none-match'] && typeof modified === 'string' && !Number.isNaN(Date.parse(modified)) && info.mtimeMs < Date.parse(modified) + 1000)) {
        response.writeHead(304, { etag, 'last-modified': headers['last-modified'] });
        response.end();
        return true;
    }
    response.writeHead(200, headers);
    if (request.method === 'HEAD') response.end();
    else await pipeline(createReadStream(actual), response);
    return true;
}

/** Create a Node request listener. The caller owns the HTTP server and ArcServer lifetime. */
export function createArcNodeHandler(server: ArcServer, options: ArcNodeOptions = {}): (request: IncomingMessage, response: ServerResponse) => void {
    return nodeHandler(server, options);
}
function nodeHandler(server: ArcServer, options: ArcNodeOptions, streams?: Set<ServerResponse>): (request: IncomingMessage, response: ServerResponse) => void {
    validateOptions(options);
    const root = options.staticFiles?.root ? resolve(options.staticFiles.root) : undefined;
    const prefix = server.options.prefix ?? 'api';
    return (request, response) => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        const onClose = () => { if (!response.writableEnded) abort(); };
        request.on('aborted', abort);
        response.on('close', onClose);
        void (async () => {
            const raw = request.url ?? '';
            const rawPath = raw.split('?')[0] ?? '';
            let url: URL;
            try { url = new URL(raw, origin); }
            catch { notFound(response); return; }
            if (url.origin !== origin || url.pathname !== rawPath) { notFound(response); return; }
            const base = options.pathBase ?? '';
            if (base && rawPath !== base && !rawPath.startsWith(base + '/')) { notFound(response); return; }
            const path = rawPath.slice(base.length) || '/';
            // Arc owns an endpoint regardless of method. Never let a static asset shadow its 405.
            if (server.endpoints.has(path)) {
                const target = new URL(path + url.search, origin);
                const body = request.method === 'POST' || request.method === 'QUERY' ? Readable.toWeb(request) as ReadableStream<Uint8Array> : undefined;
                const init: RequestInit & { duplex?: 'half' } = {
                    method: request.method, headers: new Headers(request.headers as Record<string, string>), body, signal: controller.signal
                };
                if (body) init.duplex = 'half';
                const result = await server.handle(new Request(target, init), () => ({
                    ...options.native?.(request), secure: request.socket instanceof TLSSocket && request.socket.encrypted === true
                }));
                if (!result) { notFound(response); return; }
                result.headers.forEach((value, key) => {
                    if (key === 'set-cookie') response.setHeader(key, result.headers.getSetCookie());
                    else response.setHeader(key, value);
                });
                response.statusCode = result.status;
                if (request.method === 'HEAD') { await result.body?.cancel(); response.end(); return; }
                if (result.headers.get('content-type')?.startsWith('text/event-stream')) streams?.add(response);
                try {
                    if (result.body) await pipeline(Readable.fromWeb(result.body as unknown as NodeReadableStream), response);
                    else response.end();
                } finally { streams?.delete(response); }
                return;
            }
            const segments = safeSegments(path);
            if (!segments) { notFound(response); return; }
            if ((request.method === 'GET' || request.method === 'HEAD') && root) {
                if (await file(request, response, root, segments, options.staticFiles?.defaultDocument ?? 'index.html')) return;
                const apiPath = '/' + prefix;
                if (options.fallback && !extname(path) && path !== '/.cratis' && !path.startsWith('/.cratis/') &&
                    path !== apiPath && !path.startsWith(apiPath + '/') &&
                    request.headers.accept?.split(',').some(part => part.trim().toLowerCase().startsWith('text/html'))) {
                    if (await file(request, response, root, options.fallback.split('/'))) return;
                }
            }
            notFound(response);
        })().catch(() => {
            if (controller.signal.aborted || response.destroyed) return;
            if (!response.headersSent) response.writeHead(500);
            response.end();
        }).finally(() => {
            request.off('aborted', abort);
            response.off('close', onClose);
        });
    };
}

/** Start listening. close() drains requests; ArcServer remains caller-owned. Attach upgrade handlers on the returned server for future transports. */
export async function runArc(server: ArcServer, options: ArcNodeRunOptions = {}): Promise<{ server: ReturnType<typeof createServer>; close(): Promise<void> }> {
    const streams = new Set<ServerResponse>();
    const handler = nodeHandler(server, options, streams);
    const listener = options.https ? createHttpsServer(options.https, handler) : createServer(handler);
    try {
        await new Promise<void>((resolveListen, reject) => {
            listener.once('error', reject);
            listener.listen(options.port ?? 3000, options.host ?? '127.0.0.1', () => { listener.off('error', reject); resolveListen(); });
        });
    } catch (error) { listener.close(); throw error; }
    return { server: listener, close: () => new Promise<void>((resolveClose, reject) => {
        listener.close(error => error ? reject(error) : resolveClose());
        for (const stream of streams) stream.destroy();
    }) };
}
