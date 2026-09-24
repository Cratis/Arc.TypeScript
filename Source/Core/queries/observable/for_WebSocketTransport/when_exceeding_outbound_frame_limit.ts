// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { EventEmitter } from 'node:events';
import WebSocket from 'ws';
import { should } from 'vitest';
import { WebSocketTransport } from '../WebSocketTransport.js';
import { HubFrameType } from '../HubFrameType.js';
import { ObservableLimits } from '../ObservableLimits.js';

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

describe('when exceeding the socket outbound frame limit', () => {
    let output: WebSocketTransport;
    let outcomes: PromiseSettledResult<void>[];

    beforeEach(async () => {
        output = new WebSocketTransport(new BlockingSocket() as unknown as WebSocket,
            new ObservableLimits({ maxObservableOutboundFrames: 64 }));
        const waiting = Array.from({ length: 64 }, () => output.send({ type: HubFrameType.QueryResult }));
        outcomes = await Promise.allSettled([...waiting, output.send({ type: HubFrameType.QueryResult })]);
    });

    it('should reject all pending socket writes', () => { outcomes.every(outcome => outcome.status === 'rejected').should.equal(true); });
    it('should abort the connection', () => { output.signal.aborted.should.equal(true); });
});
