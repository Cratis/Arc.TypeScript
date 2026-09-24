// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Readable } from 'node:stream';
import { TLSSocket } from 'node:tls';
import type { Express, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import type { ArcServer, NativeRequestContext } from '@cratis/arc.server';

const origin = 'http://arc.invalid';
/** The callback must use host-verified identity/authority, never request headers. */
export function mountExpress(app: Express, server: ArcServer, native?: (request: ExpressRequest) => Omit<NativeRequestContext, 'secure'>): void {
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
            const result = await server.handle(new Request(url, init), () => ({ ...native?.(request), secure: request.socket instanceof TLSSocket && request.socket.encrypted === true }));
            if (!result) return next();
            response.status(result.status);
            result.headers.forEach((value, key) => {
                if (key === 'set-cookie') {
                    const existing = response.getHeader('set-cookie');
                    response.setHeader(key, [...(Array.isArray(existing) ? existing : typeof existing === 'string' ? [existing] : []), ...result.headers.getSetCookie()]);
                } else response.setHeader(key, value);
            });
            response.end(Buffer.from(await result.arrayBuffer()));
        } catch (error) { next(error); }
        finally {
            request.off('aborted', abort);
            response.off('close', onClose);
        }
    });
}
