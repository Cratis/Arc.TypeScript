// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IncomingMessage } from 'node:http';
import { extname } from 'node:path';

/** Reserve Arc's API and metadata namespaces, even when the requested spelling has different case. */
export function reservedPath(path: string, prefix: string): boolean {
    const lower = path.toLowerCase();
    const api = '/' + prefix.toLowerCase();
    return lower === api || lower.startsWith(api + '/') || lower === '/.cratis' || lower.startsWith('/.cratis/');
}

/** Only an extensionless HTML navigation may receive the public SPA shell. */
export function isNavigation(request: IncomingMessage, path: string): boolean {
    return !extname(path) && request.headers.accept?.split(',').some(part => part.trim().toLowerCase().startsWith('text/html')) === true;
}
