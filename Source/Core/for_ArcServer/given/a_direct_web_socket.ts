// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import type { Server as HttpServer } from 'node:http';
import { beforeDeadline } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

/** Open a real Node direct-query WebSocket and wait until its first data frame. */
export async function openDirectWebSocket(listener: HttpServer | number): Promise<WebSocket> {
    const port = typeof listener === 'number' ? listener : (listener.address() as AddressInfo).port;
    const socket = new WebSocket(`ws://127.0.0.1:${port}/api/live`);
    const ready = new Promise<void>((resolve, reject) => {
        socket.once('message', () => resolve());
        socket.once('error', reject);
    });
    try { await beforeDeadline(ready, 'direct WebSocket data'); }
    catch (error) { socket.terminate(); throw error; }
    return socket;
}
