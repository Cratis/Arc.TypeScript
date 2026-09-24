// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { HubTransport } from './HubTransport.js';
import { HubFrameType } from './HubFrameType.js';

/** Reschedule a hub heartbeat from its last successful outbound write. */
export class HubKeepAlive {
    #timer: ReturnType<typeof setTimeout> | undefined;
    #removeActivity: (() => void) | undefined;
    #stopped = false;

    constructor(readonly output: HubTransport, readonly intervalMs: number,
        readonly onFailure: () => void) {}

    start(): void {
        if (this.intervalMs <= 0) return;
        this.#removeActivity = this.output.onActivity?.(() => this.schedule());
        this.schedule();
    }

    stop(): void {
        this.#stopped = true;
        if (this.#timer) clearTimeout(this.#timer);
        this.#removeActivity?.();
    }

    private schedule(): void {
        if (this.#stopped || this.intervalMs <= 0) return;
        if (this.#timer) clearTimeout(this.#timer);
        const remaining = this.output.lastActivity + this.intervalMs - Date.now();
        this.#timer = setTimeout(() => {
            if (this.#stopped) return;
            if (Date.now() - this.output.lastActivity < this.intervalMs) {
                this.schedule();
                return;
            }
            void this.output.send({ type: HubFrameType.Ping })
                .then(() => this.schedule(), this.onFailure);
        }, Math.max(1, remaining));
    }
}
