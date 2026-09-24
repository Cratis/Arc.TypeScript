// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { isAbsolute, relative, sep } from 'node:path';

/** Decode once; reject non-canonical spelling and unsafe filesystem components. */
export function safeSegments(path: string, wellKnown: readonly string[] = []): string[] | undefined {
    if (!path.startsWith('/') || path.startsWith('//')) return undefined;
    const segments: string[] = [];
    for (const part of path.split('/').slice(1)) {
        let decoded: string;
        try { decoded = decodeURIComponent(part); } catch { return undefined; }
        if (decoded === '.' || decoded === '..' || /[\\/\0%:]/.test(decoded)) return undefined;
        if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(decoded)) return undefined;
        if (decoded.startsWith('.') && !(decoded === '.well-known' && segments.length === 0)) return undefined;
        if (decoded) segments.push(decoded);
    }
    const canonical = '/' + segments.join('/') + (path.endsWith('/') && segments.length ? '/' : '');
    if (canonical !== path) return undefined;
    if (segments[0] === '.well-known' && !wellKnown.includes(segments.join('/'))) return undefined;
    return segments;
}

/** Validate a relative public file name, never a dotfile or device path. */
export function safeFile(path: string): boolean {
    const segments = safeSegments('/' + path);
    return !isAbsolute(path) && !!segments?.length && segments.join('/') === path;
}

/** True when a resolved path stays inside the public directory. */
export function contained(root: string, target: string): boolean {
    const path = relative(root, target);
    return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

/** Strip a segment-delimited path base without changing the routed URL's spelling. */
export function stripPathBase(path: string, base: string): string | undefined {
    if (!base) return path;
    if (path.toLowerCase() === base.toLowerCase()) return '/';
    if (!path.toLowerCase().startsWith(base.toLowerCase() + '/')) return undefined;
    return path.slice(base.length);
}
