// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BadRequest } from './BadRequest.js';

function clean(value: unknown, depth = 0): unknown {
    if (depth > 32) throw new BadRequest();
    if (typeof value === 'number' && !Number.isFinite(value)) throw new BadRequest();
    if (Array.isArray(value)) return value.map(item => clean(item, depth + 1));
    if (value && typeof value === 'object') {
        const result: Record<string, unknown> = Object.create(null);
        for (const [key, entry] of Object.entries(value)) {
            if (key === '__proto__' || key === 'prototype' || key === 'constructor') throw new BadRequest();
            result[key] = clean(entry, depth + 1);
        }
        return result;
    }
    return value;
}
export async function body(request: Request, limit: number): Promise<unknown> {
    if (Number(request.headers.get('content-length')) > limit) throw new BadRequest();
    if (!request.body) throw new BadRequest();
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            bytes += value.byteLength;
            if (bytes > limit) throw new BadRequest();
            chunks.push(value);
        }
    } finally { await reader.cancel(); }
    try {
        const combined = new Uint8Array(bytes);
        let offset = 0;
        for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; }
        const text = new TextDecoder('utf-8', { fatal: true }).decode(combined);
        return clean(JSON.parse(text) as unknown);
    } catch { throw new BadRequest(); }
}
