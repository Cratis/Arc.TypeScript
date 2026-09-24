// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should, vi } from 'vitest';
import { ArcServer, Severity } from '../src/index.js';
import type { ExecutionContext } from '../src/index.js';
import type { HubFrame } from '../src/queries/observable/HubFrame.js';
import { HubFrameType } from '../src/queries/observable/HubFrameType.js';
import { HubConnection } from '../src/queries/observable/HubConnection.js';

should();

class RecordedOutput {
    readonly controller = new AbortController();
    readonly frames: HubFrame[] = [];
    readonly sentAt: number[] = [];
    lastActivity = Date.now();
    get signal(): AbortSignal { return this.controller.signal; }
    async send(frame: HubFrame): Promise<void> {
        this.frames.push(frame);
        this.lastActivity = Date.now();
        this.sentAt.push(this.lastActivity);
    }
    close(): void { this.controller.abort(); }
}

function context(): ExecutionContext {
    return { correlationId: crypto.randomUUID(), principal: undefined, tenantId: undefined,
        allowedSeverity: Severity.Warning, signal: new AbortController().signal };
}

describe('observable hub keep-alive', () => {
    it('should send Ping only after an entire interval without an outbound frame', async () => {
        vi.useFakeTimers();
        const server = new ArcServer({});
        const output = new RecordedOutput();
        const connection = new HubConnection(server, 'WebSocket', output, context(), 1000, () => {}, () => {});
        try {
            await connection.connect();
            await vi.advanceTimersByTimeAsync(500);
            await output.send({ type: HubFrameType.QueryResult });
            await vi.advanceTimersByTimeAsync(500);
            output.frames.filter(frame => frame.type === HubFrameType.Ping).should.have.lengthOf(0);
            await vi.advanceTimersByTimeAsync(500);
            output.frames.filter(frame => frame.type === HubFrameType.Ping).should.have.lengthOf(1);
            const dataTime = output.sentAt[1]!;
            const pingTime = output.sentAt[2]!;
            (pingTime - dataTime <= 1000).should.equal(true);
        } finally { await connection.close(); await server.dispose(); vi.useRealTimers(); }
    });

    it('should advertise zero and never schedule a keep-alive when disabled', async () => {
        vi.useFakeTimers();
        const server = new ArcServer({});
        const output = new RecordedOutput();
        const connection = new HubConnection(server, 'SSE', output, context(), 0, () => {}, () => {});
        try {
            await connection.connect();
            should().equal(output.frames[0]?.keepAliveIntervalMs, 0);
            await vi.advanceTimersByTimeAsync(60_000);
            output.frames.should.have.lengthOf(1);
        } finally { await connection.close(); await server.dispose(); vi.useRealTimers(); }
    });
});
