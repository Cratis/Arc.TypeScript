// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serve } from '@hono/node-server';
import type { Context, Env, Hono } from 'hono';
import { createServer, type Server } from 'node:http';
import type { ArcApplication, ArcServer, NativeRequestContext } from '@cratis/arc.core';
import { createHonoWebSockets } from './WebSocketMount.js';
import { serverOf } from '@cratis/arc.core/hosting';

/** Serve a Hono app with Arc observable upgrades on a Node listener; caller owns the Arc application. */
export async function serveCratisArc<E extends Env>(app: Hono<E>, arc: ArcServer | ArcApplication, options: {
    port: number;
    hostname?: string;
    native?: (context: Context<E>) => NativeRequestContext | Promise<NativeRequestContext>;
}): Promise<{ server: Server; dispose(): Promise<void> }> {
    const bridge = createHonoWebSockets(app, serverOf(arc), options.native);
    let server: Server;
    try {
        server = serve({ fetch: app.fetch, port: options.port, hostname: options.hostname, createServer }) as Server;
        await new Promise<void>((resolve, reject) => {
            server.once('listening', resolve);
            server.once('error', reject);
        });
        bridge.injectWebSocket(server);
    } catch (error) {
        await bridge.dispose();
        throw error;
    }
    return {
        server,
        async dispose() {
            await bridge.dispose();
            const closed = new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
            // Active SSE responses keep server.close() pending until their clients leave.
            server.closeAllConnections();
            await closed;
        }
    };
}
