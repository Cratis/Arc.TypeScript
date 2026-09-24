// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { TLSSocket } from 'node:tls';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Express, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import { attachNodeWebSockets } from '@cratis/arc.core';
import type { ArcServer, NativeRequestContext } from '@cratis/arc.core';

const origin = 'http://arc.invalid';
/** The callback must use host-verified identity/authority, never request headers. */
export function mountExpress(app: Express, server: ArcServer,
    native?: (request: ExpressRequest) => NativeRequestContext | Promise<NativeRequestContext>): void {
    app.use(async (request: ExpressRequest, response: ExpressResponse, next: NextFunction) => {
        const rawPath = request.originalUrl.split('?')[0] ?? '';
        if (!server.endpoints.has(rawPath)) return next();
        let url: URL;
        try { url = new URL(request.originalUrl, origin); }
        catch { return next(); }
        if (url.origin !== origin || url.pathname !== rawPath) return next();
        const controller = new AbortController();
        const abort = () => controller.abort();
        const onClose = () => { if (!response.writableEnded) abort(); };
        request.on('aborted', abort);
        response.on('close', onClose);
        try {
            const body = request.method === 'POST' || request.method === 'QUERY' ? Readable.toWeb(request) as ReadableStream<Uint8Array> : undefined;
            const init: RequestInit & { duplex?: 'half' } = { method: request.method, headers: new Headers(request.headers as Record<string, string>), body, signal: controller.signal };
            if (body) init.duplex = 'half';
            const result = await server.handle(new Request(url, init), async () => {
                const verified = await native?.(request);
                return { ...verified, remoteAddress: verified?.remoteAddress ?? request.socket.remoteAddress,
                    secure: verified?.secure ?? (request.socket instanceof TLSSocket && request.socket.encrypted === true) };
            });
            if (!result) return next();
            response.status(result.status);
            result.headers.forEach((value, key) => {
                if (key === 'set-cookie') {
                    const existing = response.getHeader('set-cookie');
                    response.setHeader(key, [...(Array.isArray(existing) ? existing : typeof existing === 'string' ? [existing] : []), ...result.headers.getSetCookie()]);
                } else response.setHeader(key, value);
            });
            if (result.headers.get('content-type')?.startsWith('text/event-stream')) {
                if (!result.body) throw new Error('Observable query stream has no response body');
                await pipeline(Readable.fromWeb(result.body as unknown as NodeReadableStream), response);
            } else response.end(Buffer.from(await result.arrayBuffer()));
        } catch (error) { if (!controller.signal.aborted) next(error); }
        finally {
            request.off('aborted', abort);
            response.off('close', onClose);
        }
    });
}

/** Bridge upgrades on the listener returned by app.listen(); the Arc server owns protocol and shutdown. */
export function mountExpressWebSockets(host: HttpServer, server: ArcServer,
    native?: (request: IncomingMessage) => NativeRequestContext | Promise<NativeRequestContext>): () => Promise<void> {
    return attachNodeWebSockets(host, server, native);
}
