// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { ArcServer } from '../ArcServer.js';
import type { ArcNodeOptions } from './ArcNodeOptions.js';
import { dispatchToArc } from './dispatchToArc.js';
import { isNavigation, reservedPath } from './navigationFallback.js';
import { safeSegments, stripPathBase } from './requestPath.js';
import { serveFile } from './serveFile.js';
import { validateOptions } from './validateOptions.js';

const origin = 'http://arc.invalid';

/** Create a Node request listener. The caller owns the HTTP server, its shutdown, and ArcServer's lifetime. */
export function createArcNodeHandler(
    server: ArcServer, options: ArcNodeOptions = {}
): (request: IncomingMessage, response: ServerResponse) => void {
    return nodeHandler(server, options);
}

/** Construct the routing listener with optional SSE lifecycle hooks owned by runArc. */
export function nodeHandler(
    server: ArcServer, options: ArcNodeOptions, registerStream: (stream: ServerResponse) => void = () => {},
    unregisterStream: (stream: ServerResponse) => void = () => {}
): (request: IncomingMessage, response: ServerResponse) => void {
    validateOptions(options);
    const root = options.staticFiles?.root ? resolve(options.staticFiles.root) : undefined;
    const prefix = server.options.generatedApis?.routePrefix ?? 'api';
    const wellKnown = options.staticFiles?.wellKnown ?? [];
    const configuredTypes = Object.fromEntries(Object.entries(options.staticFiles?.contentTypes ?? {})
        .map(([extension, type]) => [extension.toLowerCase(), type]));
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
            const path = stripPathBase(rawPath, options.pathBase ?? '');
            if (path === undefined) { notFound(response); return; }
            // Canonicalize before comparing any namespace: alternate spellings must not shadow Arc.
            const segments = safeSegments(path, wellKnown);
            if (!segments && !path.toLowerCase().startsWith('/.cratis')) { notFound(response); return; }
            const endpoint = [...server.endpoints.keys()].find(route => route.toLowerCase() === path.toLowerCase());
            if (endpoint && endpoint !== path) { notFound(response); return; }
            if (endpoint) {
                await dispatchToArc(
                    server, request, response, path, url.search, controller.signal, options, registerStream, unregisterStream
                );
                return;
            }
            if (!segments || reservedPath(path, prefix)) { notFound(response); return; }
            if ((request.method === 'GET' || request.method === 'HEAD') && root) {
                const fileOptions = { contentTypes: configuredTypes };
                if (await serveFile(request, response, root, segments, {
                    ...fileOptions, defaultDocument: options.staticFiles?.defaultDocument ?? 'index.html',
                    urlPath: rawPath, search: url.search,
                    wellKnown: segments[0] === '.well-known'
                })) return;
                if (options.fallback && isNavigation(request, path)) {
                    if (await serveFile(request, response, root, options.fallback.split('/'), { ...fileOptions, fallback: true })) return;
                }
            }
            notFound(response);
        })().catch(error => {
            if (controller.signal.aborted || response.destroyed) return;
            try { server.options.logger?.(error, ''); } catch { /* A failing logger must not crash the listener. */ }
            if (!response.headersSent) response.writeHead(500, { 'x-content-type-options': 'nosniff' });
            response.end();
        }).finally(() => {
            request.off('aborted', abort);
            response.off('close', onClose);
        });
    };
}

function notFound(response: ServerResponse): void {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' });
    response.end('Not Found');
}
