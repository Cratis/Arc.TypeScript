// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { describe, it, should } from 'vitest';
import { SseHubTransport } from '../src/queries/observable/SseHubTransport.js';
import { WebSocketTransport } from '../src/queries/observable/WebSocketTransport.js';
import { HubFrameType } from '../src/queries/observable/HubFrameType.js';
import { ObservableLimits } from '../src/queries/observable/ObservableLimits.js';

should();

class BlockingSocket extends EventEmitter {
    readonly OPEN = WebSocket.OPEN;
    readonly CONNECTING = WebSocket.CONNECTING;
    readyState: number = WebSocket.OPEN;
    bufferedAmount = 0;
    send(_json: string, callback: (error?: Error) => void): void { void _json; void callback; }
    close(): void { this.readyState = WebSocket.CLOSED; this.emit('close'); }
    terminate(): void { this.close(); }
}

describe('observable hub outbound bounds', () => {
    it('should close an SSE connection rather than queueing a 65th pending frame', async () => {
        const output = new SseHubTransport(new ObservableLimits({ maxObservableOutboundFrames: 64 }));
        await output.send({ type: HubFrameType.Connected });
        const waiting = Array.from({ length: 64 }, () => output.send({ type: HubFrameType.QueryResult }));
        const rejected = output.send({ type: HubFrameType.QueryResult });
        const outcomes = await Promise.allSettled([...waiting, rejected]);
        outcomes[64]?.status.should.equal('rejected');
        output.signal.aborted.should.equal(true);
    });

    it('should cancel pending socket writes and their queue when a connection is overloaded', async () => {
        const socket = new BlockingSocket();
        const output = new WebSocketTransport(socket as unknown as WebSocket,
            new ObservableLimits({ maxObservableOutboundFrames: 64 }));
        const waiting = Array.from({ length: 64 }, () => output.send({ type: HubFrameType.QueryResult }));
        const rejected = output.send({ type: HubFrameType.QueryResult });
        const outcomes = await Promise.allSettled([...waiting, rejected]);
        outcomes.every(outcome => outcome.status === 'rejected').should.equal(true);
        output.signal.aborted.should.equal(true);
    });
});
