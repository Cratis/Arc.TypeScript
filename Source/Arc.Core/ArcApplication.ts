// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { ArcServer } from './ArcServer.js';
import type { ArcServerOptions } from './ArcServerOptions.js';
import { ArcApplicationBuilder } from './ArcApplicationBuilder.js';
import { runArc } from './http/runArc.js';
import type { ArcNodeRunOptions } from './http/ArcNodeRunOptions.js';

export class ArcApplication {
    static createBuilder(options: ArcServerOptions = {}): ArcApplicationBuilder { return new ArcApplicationBuilder(options); }
    #listener?: { server: HttpServer | HttpsServer; close(): Promise<void> };
    #disposed = false;
    constructor(readonly server: ArcServer) {}
    async run(options?: ArcNodeRunOptions): Promise<void> {
        if (this.#disposed) throw new Error('Arc application is disposed');
        if (this.#listener) throw new Error('Arc application is already running');
        this.#listener = await runArc(this.server, options);
    }
    async stop(): Promise<void> {
        if (this.#disposed) return;
        this.#disposed = true;
        const listener = this.#listener;
        this.#listener = undefined;
        const failures: unknown[] = [];
        try { await listener?.close(); } catch (error) { failures.push(error); }
        try { await this.server.dispose(); } catch (error) { failures.push(error); }
        if (failures.length === 1) throw failures[0];
        if (failures.length) throw new AggregateError(failures, 'Arc application shutdown failed');
    }
    async dispose(): Promise<void> { await this.stop(); }
}
