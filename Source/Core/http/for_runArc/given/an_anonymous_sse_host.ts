// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { once } from 'node:events';
import { request, type ClientRequest, type IncomingMessage } from 'node:http';
import { ArcServer } from '../../../ArcServer.js';
import { runArc } from '../../runArc.js';
import { portOf } from './a_node_host.js';

export class an_anonymous_sse_host {
    readonly arc = new ArcServer({ query: { maxObservableHubConnectionsPerCaller: 1 } });
    host?: Awaited<ReturnType<typeof runArc>>;
    readonly connections: ClientRequest[] = [];

    async start(): Promise<void> { this.host = await runArc(this.arc, { port: 0, host: '::' }); }

    async send(address: string, path: string, method = 'GET', body?: string): Promise<IncomingMessage> {
        const outgoing = request({ host: address, port: portOf(this.host!.server), path, method,
            localAddress: address, headers: { 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.1' } });
        this.connections.push(outgoing);
        const incoming = once(outgoing, 'response') as Promise<[IncomingMessage]>;
        outgoing.end(body);
        return (await incoming)[0];
    }

    async open(address: string): Promise<{ response: IncomingMessage; id: string }> {
        const response = await this.send(address, '/.cratis/queries/sse');
        if (response.statusCode !== 200) { response.resume(); return { response, id: '' }; }
        const [data] = await once(response, 'data') as [Buffer];
        return { response, id: JSON.parse(data.toString().slice(6)).payload as string };
    }

    async dispose(): Promise<void> {
        for (const connection of this.connections) connection.destroy();
        await this.host?.close();
        await this.arc.dispose();
    }
}
