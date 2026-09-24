// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';
import { ArcServer } from '@cratis/arc.core';
import { attachNodeWebSockets } from '@cratis/arc.core/hosting';

test('Node bridge leaves another upgrade route socket error handling to its owner', async () => {
    const server = new ArcServer({});
    const listener = createServer();
    const dispose = attachNodeWebSockets(listener, server);
    const others = new WebSocketServer({ noServer: true });
    let errorListeners = -1;
    listener.on('upgrade', (request, socket, head) => {
        if (request.url !== '/mine') return;
        errorListeners = socket.listenerCount('error');
        others.handleUpgrade(request, socket, head, connection => connection.close());
    });
    await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
    const socket = new WebSocket(`ws://127.0.0.1:${listener.address().port}/mine`);
    try {
        await new Promise(resolve => socket.addEventListener('close', resolve));
        assert.equal(errorListeners, 0);
    } finally {
        socket.terminate();
        await dispose();
        await new Promise(resolve => listener.close(resolve));
        others.close();
        await server.dispose();
    }
});
