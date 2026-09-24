// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from '../../ArcServer.js';
import type { NativeRequestContext } from '../../http/NativeRequestContext.js';
import { directWebSocket } from './directWebSocket.js';
import type { ResolvedConnectionContext } from './ResolvedConnectionContext.js';
import { WebSocketTransport } from './WebSocketTransport.js';
import type { NodeWebSocketLike } from './NodeWebSocketLike.js';

/** Host adapters bridge an already-upgraded socket; all frames remain core-owned. */
export function serveUpgradedSocket(server: ArcServer, socket: NodeWebSocketLike, request: Request,
    native: NativeRequestContext | undefined, resolved: ResolvedConnectionContext): { close(): void; completion: Promise<void> } {
    const transport = new WebSocketTransport(socket, server.observableLimits);
    const path = new URL(request.url).pathname;
    const completion = path === '/.cratis/queries/ws'
        ? server.handleObservableHubSocket(request, transport, native, resolved)
        : directWebSocket(server, request, transport, native, resolved);
    return { close: () => transport.close(), completion };
}
