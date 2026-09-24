// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { constants } from 'node:fs';
import { open, realpath } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, relative, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { contentTypes } from './contentTypes.js';
import { notModified } from './conditionalRequest.js';
import { contained } from './requestPath.js';

/** Open a resolved public file without following a swapped final symlink; send exactly the opened file's measured length. */
export async function serveFile(
    request: IncomingMessage, response: ServerResponse, root: string, segments: string[],
    options: {
        defaultDocument?: string; fallback?: boolean; contentTypes?: Record<string, string>;
        urlPath?: string; search?: string; wellKnown?: boolean
    }
): Promise<boolean> {
    let base: string;
    try { base = await realpath(root); }
    catch (error) { if (missing(error)) return false; throw error; }
    const target = resolve(base, ...segments);
    if (!contained(base, target)) return false;
    let actual: string;
    try { actual = await realpath(target); }
    catch (error) { if (missing(error)) return false; throw error; }
    const parts = relative(base, actual).split(sep);
    if (!contained(base, actual) || parts.some((part, index) => part.startsWith('.') &&
        !(options.wellKnown && index === 0 && part === '.well-known'))) return false;
    let handle;
    if (constants.O_NOFOLLOW === undefined) throw Error('Static file serving requires O_NOFOLLOW');
    try { handle = await open(actual, constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (error) { if (missing(error)) return false; throw error; }
    try {
        // Recheck intermediate directory components after opening; O_NOFOLLOW guards the final component.
        let openedPath: string;
        try { openedPath = await realpath(actual); }
        catch (error) { if (missing(error)) return false; throw error; }
        if (openedPath !== actual) return false;
        const info = await handle.stat();
        if (info.isDirectory() && options.defaultDocument) {
            if (options.urlPath && !options.urlPath.endsWith('/')) {
                response.writeHead(301, { location: options.urlPath + '/' + (options.search ?? ''), 'x-content-type-options': 'nosniff' });
                response.end();
                return true;
            }
            return serveFile(request, response, base, [...segments, ...options.defaultDocument.split('/')], {
                ...options, defaultDocument: undefined, fallback: true, urlPath: undefined
            });
        }
        if (!info.isFile()) return false;
        const etag = `"${info.size.toString(16)}-${Math.trunc(info.mtimeMs).toString(16)}"`;
        const headers: Record<string, string | number> = {
            'content-type': options.contentTypes?.[extname(actual).toLowerCase()] ?? contentTypes[extname(actual).toLowerCase()]
                ?? 'application/octet-stream',
            'content-length': info.size,
            'last-modified': info.mtime.toUTCString(),
            'x-content-type-options': 'nosniff',
            'accept-ranges': 'none',
            etag
        };
        if (options.fallback) headers['cache-control'] = 'no-cache';
        if (notModified(request, etag, info)) {
            response.writeHead(304, {
                etag, 'last-modified': info.mtime.toUTCString(),
                'x-content-type-options': 'nosniff', 'accept-ranges': 'none',
                ...(options.fallback ? { 'cache-control': 'no-cache' } : {})
            });
            response.end();
            return true;
        }
        response.writeHead(200, headers);
        if (request.method === 'HEAD' || info.size === 0) response.end();
        else await pipeline(handle.createReadStream({ start: 0, end: info.size - 1, autoClose: false }), response);
        return true;
    } finally { await handle.close(); }
}

function missing(error: unknown): boolean {
    return typeof error === 'object' && error !== null && 'code' in error &&
        (error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'ELOOP');
}
