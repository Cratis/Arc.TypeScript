// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { constants } from 'node:fs';
import { realpath, stat } from 'node:fs/promises';
import { createServer, type Server as HttpServer, type ServerResponse } from 'node:http';
import { createServer as createHttpsServer, type Server as HttpsServer } from 'node:https';
import type { ArcServer } from '../ArcServer.js';
import type { ArcNodeRunOptions } from './ArcNodeRunOptions.js';
import { nodeHandler } from './createArcNodeHandler.js';
import { attachNodeWebSockets } from '../queries/observable/attachNodeWebSockets.js';

/** Start listening; shutdown drains ordinary requests for up to 30 seconds, then closes connections. ArcServer remains caller-owned. */
export async function runArc(
    server: ArcServer, options: ArcNodeRunOptions = {}
): Promise<{ server: HttpServer | HttpsServer; close(options?: { timeoutMs?: number }): Promise<void> }> {
    const streams = new Set<ServerResponse>();
    let closing = false;
    const handler = nodeHandler(server, options, stream => {
        if (closing) stream.destroy();
        else streams.add(stream);
    }, stream => streams.delete(stream));
    if (options.staticFiles) {
        if (constants.O_NOFOLLOW === undefined) throw Error('Static file serving requires O_NOFOLLOW');
        const root = await realpath(options.staticFiles.root);
        if (!(await stat(root)).isDirectory()) throw Error('Static file root must be a directory');
    }
    const listener = options.https ? createHttpsServer(options.https, handler) : createServer(handler);
    const closeWebSockets = attachNodeWebSockets(listener, server, request => ({ ...options.native?.(request), secure: undefined }), options.pathBase);
    listener.on('connect', (_request, socket) => {
        socket.end('HTTP/1.1 405 Method Not Allowed\r\nConnection: close\r\nContent-Length: 0\r\nX-Content-Type-Options: nosniff\r\n\r\n');
    });
    // Node servers can emit accept errors after listen has succeeded. Never leave an error event unhandled.
    listener.on('error', error => {
        try { server.options.logger?.(error, ''); } catch { /* An error logger cannot crash the host. */ }
    });
    try { await new Promise<void>((resolveListen, reject) => {
        const onError = (error: Error) => { listener.off('listening', onListening); reject(error); };
        const onListening = () => { listener.off('error', onError); resolveListen(); };
        listener.once('error', onError);
        listener.once('listening', onListening);
        try { listener.listen(options.port ?? 3000, options.host ?? '127.0.0.1'); }
        catch (error) { listener.off('error', onError); listener.off('listening', onListening); reject(error); }
    }); } catch (error) { await closeWebSockets(); throw error; }
    let pendingClose: Promise<void> | undefined;
    return { server: listener, close: ({ timeoutMs = 30_000 } = {}) => {
        if (pendingClose) return pendingClose;
        if (!Number.isFinite(timeoutMs) || timeoutMs < 0) return Promise.reject(Error('Invalid shutdown timeout'));
        closing = true;
        pendingClose = (async () => {
            const httpClosed = new Promise<void>((resolveClose, reject) => {
                listener.close(error => error ? reject(error) : resolveClose());
            });
            for (const stream of streams) stream.destroy();
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
                const webSockets = closeWebSockets();
                const deadline = new Promise<never>((_, reject) => {
                    timer = setTimeout(() => {
                        listener.closeAllConnections();
                        reject(new Error('Arc host shutdown timed out'));
                    }, timeoutMs);
                });
                const socketOutcome = await Promise.race([webSockets.then(() => undefined, error => error),
                    deadline.then(() => undefined, error => error)]);
                if (socketOutcome) throw socketOutcome;
                await Promise.race([httpClosed, deadline.catch(() => new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Arc host shutdown timed out')), 100);
                }))]);
            } finally { if (timer) clearTimeout(timer); }
        })();
        return pendingClose;
    } };
}
