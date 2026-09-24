// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { HubFrame } from './HubFrame.js';

/** Ordered outbound frames with a bounded write queue and disconnect signal. */
export interface HubTransport {
    readonly signal: AbortSignal;
    readonly lastActivity: number;
    send(frame: HubFrame): Promise<void>;
    close(): void;
}
