// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IncomingMessage } from 'node:http';
import type { Stats } from 'node:fs';

/** HTTP weak comparison of If-None-Match takes precedence over If-Modified-Since. */
export function notModified(request: IncomingMessage, etag: string, info: Stats): boolean {
    const match = request.headers['if-none-match'];
    if (match !== undefined) {
        return match.split(',').some(tag => {
            const value = tag.trim();
            return value === '*' || value.replace(/^W\//i, '') === etag;
        });
    }
    const modified = request.headers['if-modified-since'];
    return typeof modified === 'string' && !Number.isNaN(Date.parse(modified)) && info.mtimeMs < Date.parse(modified) + 1000;
}
