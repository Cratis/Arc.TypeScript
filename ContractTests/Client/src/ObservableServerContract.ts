// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Server } from 'node:http';
import { attachNodeWebSockets, prepareObservableUpgrade, serveUpgradedSocket } from '@cratis/arc.core';
import type { ArcServer, NativeRequestContext, NodeWebSocketLike } from '@cratis/arc.core';

/** Strict consumer compilation must not need a public ws type to reference host transports. */
export function mount(host: Server, server: ArcServer): () => Promise<void> {
    return attachNodeWebSockets(host, server);
}

export async function check(server: ArcServer, socket: NodeWebSocketLike, request: Request,
    native?: NativeRequestContext): Promise<void> {
    const prepared = await prepareObservableUpgrade(server, request, native);
    if (prepared.status !== 101) return;
    const bridge = serveUpgradedSocket(server, socket, request, native, prepared.resolved);
    bridge.close();
    await bridge.completion;
}

export type PublicObservableSocket = Parameters<ArcServer['handleObservableHubSocket']>[1];
