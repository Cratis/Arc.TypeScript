// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Server as HttpServer } from 'node:http';
import type { Server as HttpsServer } from 'node:https';
import { ArcServer } from './ArcServer.js';
import type { ArcServerOptions } from './ArcServerOptions.js';
import { ArcApplicationBuilder } from './ArcApplicationBuilder.js';
import { runArc } from './http/runArc.js';
import type { ArcNodeRunOptions } from './http/ArcNodeRunOptions.js';

/** A built Arc server with optional ownership of a standalone Node listener. */
export class ArcApplication {
    /** Begin registering artifacts and services for an Arc application. */
    static createBuilder(options: ArcServerOptions = {}): ArcApplicationBuilder { return new ArcApplicationBuilder(options); }
    #listener?: { server: HttpServer | HttpsServer; close(): Promise<void> };
    #disposed = false;
    #onStopped?: (error?: unknown) => void;
    constructor(readonly server: ArcServer) {}
    /** Start listening without waiting for the application's lifetime to end. */
    async start(options?: ArcNodeRunOptions): Promise<void> {
        if (this.#disposed) throw new Error('Arc application is disposed');
        if (this.#listener) throw new Error('Arc application is already running');
        const listener = await runArc(this.server, options);
        if (this.#disposed) {
            await listener.close();
            throw new Error('Arc application is disposed');
        }
        this.#listener = listener;
    }
    /** Run until stopped or signaled, then gracefully close the listener and application. */
    async run(options?: ArcNodeRunOptions): Promise<void> {
        await this.start(options);
        await new Promise<void>((resolve, reject) => {
            const stopped = (error?: unknown) => error ? reject(error) : resolve();
            const shutdown = () => { void this.stop().catch(reject); };
            this.#onStopped = stopped;
            process.once('SIGINT', shutdown);
            process.once('SIGTERM', shutdown);
            const release = () => {
                process.removeListener('SIGINT', shutdown);
                process.removeListener('SIGTERM', shutdown);
                this.#onStopped = undefined;
            };
            // Keep signal listeners only while run() owns the application lifecycle.
            const complete = this.#onStopped;
            this.#onStopped = error => { release(); complete?.(error); };
        });
    }
    /** Gracefully stop the listener and dispose application-owned services. */
    async stop(): Promise<void> {
        if (this.#disposed) return;
        this.#disposed = true;
        const listener = this.#listener;
        this.#listener = undefined;
        const failures: unknown[] = [];
        try { await listener?.close(); } catch (error) { failures.push(error); }
        try { await this.server.dispose(); } catch (error) { failures.push(error); }
        const failure = failures.length === 1 ? failures[0] : failures.length ?
            new AggregateError(failures, 'Arc application shutdown failed') : undefined;
        this.#onStopped?.(failure);
        if (failure) throw failure;
    }
    /** Dispose the application, whether or not it started a listener. */
    async dispose(): Promise<void> { await this.stop(); }
}
