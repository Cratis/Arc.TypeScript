// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer } from '../../ArcServer.js';
import { healthServer } from './a_health_server.js';

export class an_admitted_health_subscription {
    server: ArcServer;
    eventReader!: ReadableStreamDefaultReader<Uint8Array>;
    connectionId: string = '';
    connectedType: string = '';
    subscribed: Response | null = null;

    constructor() { this.server = healthServer(); }

    async subscribe(): Promise<void> {
        const events = await this.server.handle(new Request('http://localhost/.cratis/queries/sse', {
            headers: { authorization: 'alice' }
        }));
        this.eventReader = events!.body!.getReader();
        const connected = JSON.parse(new TextDecoder().decode((await this.eventReader.read()).value).slice(6));
        this.connectionId = connected.payload;
        this.connectedType = connected.type;
        this.subscribed = await this.server.handle(new Request('http://localhost/.cratis/queries/sse/subscribe', {
            method: 'POST', headers: { authorization: 'alice', 'content-type': 'application/json' },
            body: JSON.stringify({ connectionId: this.connectionId, queryId: 'q', revision: 1,
                request: { queryName: 'Numbers' } })
        }));
    }

    async close(): Promise<void> { await this.eventReader.cancel(); await this.server.dispose(); }
}
