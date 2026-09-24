// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { HubFrameType } from './HubFrameType.js';

/** Hub JSON envelope; revision exists only for revision-aware operations. */
export interface HubFrame {
    readonly type: HubFrameType;
    readonly queryId?: string;
    readonly revision?: number;
    readonly payload?: unknown;
    readonly timestamp?: number;
    readonly keepAliveIntervalMs?: number;
    readonly supportsSubscriptionRevisions?: boolean;
}
