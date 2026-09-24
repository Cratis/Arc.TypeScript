// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Readable } from 'node:stream';
import type { Express, Request as ExpressRequest, Response as ExpressResponse, NextFunction } from 'express';
import type { ArcServer } from '@cratis/arc.server';

const origin = 'http://arc.invalid';
const introspection = ['/.cratis/commands', '/.cratis/queries', '/.cratis/identity-details/schema', '/openapi.json'];
export function mountExpress(app: Express, server: ArcServer): void {
    app.use(async (request: ExpressRequest, response: ExpressResponse, next: NextFunction) => {
        const rawPath = request.originalUrl.split('?')[0] ?? '';
        if (!server.routes.has(rawPath) && !introspection.includes(rawPath)) return next();
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
            const result = await server.handle(new Request(url, init));
            if (!result) return next();
            response.status(result.status);
            result.headers.forEach((value, key) => response.setHeader(key, value));
            response.end(Buffer.from(await result.arrayBuffer()));
        } catch (error) { next(error); }
        finally {
            request.off('aborted', abort);
            response.off('close', onClose);
        }
    });
}
