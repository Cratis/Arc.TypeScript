// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcNodeOptions } from './ArcNodeOptions.js';
import { safeFile, safeSegments } from './requestPath.js';

/** Validate configuration before any listener accepts traffic. */
export function validateOptions(options: ArcNodeOptions): void {
    const base = options.pathBase ?? '';
    if (base && !/^\/(?:[a-zA-Z0-9_-]+)(?:\/[a-zA-Z0-9_-]+)*$/.test(base)) throw Error('Invalid Arc path base');
    if (options.fallback && !options.staticFiles) throw Error('SPA fallback requires static files');
    if (options.staticFiles && (!options.staticFiles.root || !safeFile(options.staticFiles.defaultDocument ?? 'index.html'))) {
        throw Error('Invalid static file options');
    }
    if (options.fallback && !safeFile(options.fallback)) throw Error('Invalid SPA fallback file');
    for (const entry of options.staticFiles?.wellKnown ?? []) {
        if (!entry.startsWith('.well-known/') || safeSegments('/' + entry, [entry])?.join('/') !== entry) {
            throw Error('Invalid well-known file');
        }
    }
    for (const [extension, mime] of Object.entries(options.staticFiles?.contentTypes ?? {})) {
        if (!/^\.[a-z0-9]+$/i.test(extension) || !mime || /[\r\n]/.test(mime)) throw Error('Invalid content type');
    }
}
