// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { IncomingMessage } from 'node:http';
import type { NativeRequestContext } from './NativeRequestContext.js';

/** Configuration for Arc routes and public files on a Node listener. */
export interface ArcNodeOptions {
    /** Exact URL path prefix, without a trailing slash; matching ignores ASCII case. */
    pathBase?: string;
    /** Public directory; relative paths resolve from process.cwd(). Disabled when omitted. */
    staticFiles?: { root: string; defaultDocument?: string; contentTypes?: Record<string, string>; wellKnown?: readonly string[] };
    /** File within staticFiles.root used for extensionless HTML navigation requests. */
    fallback?: string;
    /** Only server-verified metadata; never derive principal or authority from HTTP headers. */
    native?: (request: IncomingMessage) => Omit<NativeRequestContext, 'secure'>;
}
