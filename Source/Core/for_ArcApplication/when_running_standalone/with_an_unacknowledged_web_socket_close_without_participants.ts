// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { connect, createServer } from 'node:net';
import type { AddressInfo, Socket } from 'node:net';
import { beforeEach, describe, it, should } from 'vitest';
import { ArcServer } from '../../ArcServer.js';
import { ArcApplication } from '../../ArcApplication.js';
import { runArc } from '../../http/runArc.js';
import { beforeDeadline, captureFailure } from '../../dependencyInjection/for_ServiceRegistry/given/a_service_lifecycle.js';

async function freePort(): Promise<number> {
    const probe = createServer();
    await new Promise<void>(resolve => probe.listen(0, '127.0.0.1', resolve));
    const port = (probe.address() as AddressInfo).port;
    await new Promise<void>(resolve => probe.close(() => resolve()));
    return port;
}

/** Upgrade a raw socket that never answers the server's close frame; it disconnects well after the shutdown budget. */
async function unacknowledgingClient(port: number): Promise<Socket> {
    const socket = connect(port, '127.0.0.1');
    socket.on('error', () => {});
    await beforeDeadline(new Promise<void>(resolve => socket.once('connect', resolve)), 'raw socket connect');
    const handshake = new Promise<void>(resolve => socket.on('data', chunk => {
        if (chunk.toString().includes('101 Switching Protocols')) resolve();
    }));
    socket.write('GET /.cratis/queries/ws HTTP/1.1\r\nHost: localhost\r\nUpgrade: websocket\r\n' +
        'Connection: Upgrade\r\nSec-WebSocket-Version: 13\r\n' +
        'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n');
    await beforeDeadline(handshake, 'WebSocket handshake');
    return socket;
}

should();
describe('when an application stops while a WebSocket client never acknowledges close and there are no participants', () => {
    let failure: unknown;
    beforeEach(async () => {
        const application = new ArcApplication(new ArcServer({ query: { observableShutdownTimeoutMs: 60 } }));
        const port = await freePort();
        await application.start({ port });
        const socket = await unacknowledgingClient(port);
        const disconnect = setTimeout(() => socket.destroy(), 300);
        try { failure = await beforeDeadline(captureFailure(application.stop()), 'application stop'); }
        finally { clearTimeout(disconnect); socket.destroy(); }
    });
    it('should stop without a transport failure', () => should().equal(failure, undefined));
});

describe('when a runArc host closes and disposes while a WebSocket client never acknowledges close and there are no participants', () => {
    let closeFailure: unknown;
    let disposeFailure: unknown;
    beforeEach(async () => {
        const server = new ArcServer({ query: { observableShutdownTimeoutMs: 60 } });
        const host = await runArc(server, { port: await freePort() });
        const socket = await unacknowledgingClient((host.server.address() as AddressInfo).port);
        const disconnect = setTimeout(() => socket.destroy(), 300);
        try {
            closeFailure = await beforeDeadline(captureFailure(host.close()), 'host close');
            disposeFailure = await beforeDeadline(captureFailure(server.dispose()), 'server dispose');
        } finally { clearTimeout(disconnect); socket.destroy(); }
    });
    it('should close the host without a transport failure', () => should().equal(closeFailure, undefined));
    it('should dispose the server without a transport failure', () => should().equal(disposeFailure, undefined));
});
