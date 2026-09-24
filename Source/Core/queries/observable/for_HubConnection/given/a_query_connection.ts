// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '../../../../ArcServer.js';
import { Severity } from '../../../../validation/Severity.js';
import type { ExecutionContext } from '../../../../execution/ExecutionContext.js';
import type { HubFrame } from '../../HubFrame.js';
import { HubConnection } from '../../HubConnection.js';

export class a_query_connection {
    controller = new AbortController();
    frames: HubFrame[] = [];
    server: ArcServer;
    connection: HubConnection;

    constructor(server: ArcServer, principal?: ExecutionContext['principal']) {
        this.server = server;
        const output = { signal: this.controller.signal, lastActivity: Date.now(),
            send: async (frame: HubFrame) => { this.frames.push(frame); output.lastActivity = Date.now(); },
            close: () => { this.controller.abort(); }
        };
        const context: ExecutionContext = { correlationId: crypto.randomUUID(),
            principal, tenantId: principal ? 'first' : undefined,
            signal: this.controller.signal, allowedSeverity: Severity.Warning };
        this.connection = new HubConnection(server, 'WebSocket', output, context, 0, () => {}, () => {});
    }

    async close(): Promise<void> { await this.connection.close(); await this.server.dispose(); }
}
