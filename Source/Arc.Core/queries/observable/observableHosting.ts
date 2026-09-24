// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../../ArcServer.js';
import type { NativeRequestContext } from '../../http/NativeRequestContext.js';
import type { ObservableSocket } from './ObservableSocket.js';
import type { ResolvedConnectionContext } from './ResolvedConnectionContext.js';

/** Adapter-only transport limits; not part of the ArcServer declaration surface. */
export function observableLimits(server: ArcServer) { return server.observableLimits; }

/** Serve a prepared hub connection without repeating authentication. */
export function handleObservableHubSocket(server: ArcServer, request: Request, transport: ObservableSocket,
    native?: NativeRequestContext, resolved?: ResolvedConnectionContext): Promise<void> {
    return server.handleObservableHubSocket(request, transport, native, resolved);
}
