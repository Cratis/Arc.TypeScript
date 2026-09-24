// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '../../../../ArcServer.js';
import { Severity } from '../../../../validation/Severity.js';
import type { ExecutionContext } from '../../../../execution/ExecutionContext.js';
import type { HubFrame } from '../../HubFrame.js';
import { HubConnection } from '../../HubConnection.js';

export class RecordedOutput {
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

export class a_recorded_connection {
    server = new ArcServer({});
    output = new RecordedOutput();
    context: ExecutionContext = { correlationId: crypto.randomUUID(), principal: undefined, tenantId: undefined,
        allowedSeverity: Severity.Warning, signal: new AbortController().signal };
    connection(interval: number, transport: 'SSE' | 'WebSocket'): HubConnection {
        return new HubConnection(this.server, transport, this.output, this.context, interval, () => {}, () => {});
    }
}
