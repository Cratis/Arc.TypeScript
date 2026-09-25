// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcOptions } from '../../ArcOptions.js';

/** One immutable, validated set of transport budgets shared by admission and adapters. */
export class ObservableLimits {
    readonly subscriptions: number;
    readonly subscriptionsPerCaller: number;
    readonly hubConnections: number;
    readonly hubConnectionsPerCaller: number;
    readonly hubSubscriptionsPerConnection: number;
    readonly inboundFrames: number;
    readonly outboundFrames: number;
    readonly pendingEmissions: number;
    readonly inboundFrameBytes: number;
    readonly outboundFrameBytes: number;
    readonly tombstones: number;
    readonly handshakeTimeoutMs: number;
    readonly shutdownTimeoutMs: number;

    constructor(options: ArcOptions) {
        const bound = (value: number | undefined, fallback: number, maximum: number, name: string): number => {
            const result = value ?? fallback;
            if (!Number.isSafeInteger(result) || result < 1 || result > maximum)
                throw new Error(`Invalid ${name}`);
            return result;
        };
        this.subscriptions = bound(options.query?.maxObservableSubscriptions, 4096, 100_000, 'observable subscription limit');
        this.subscriptionsPerCaller = bound(options.query?.maxObservableSubscriptionsPerCaller, 4096, 100_000,
            'per-caller observable subscription limit');
        this.hubConnections = bound(options.query?.maxObservableHubConnections, 512, 100_000, 'observable hub connection limit');
        this.hubConnectionsPerCaller = bound(options.query?.maxObservableHubConnectionsPerCaller, 512, 100_000,
            'per-caller observable hub connection limit');
        this.hubSubscriptionsPerConnection = bound(options.query?.maxObservableHubSubscriptionsPerConnection, 256, 10_000,
            'per-connection observable subscription limit');
        this.inboundFrames = bound(options.query?.maxObservableInboundFrames, 256, 10_000, 'observable inbound frame limit');
        this.outboundFrames = bound(options.query?.maxObservableOutboundFrames, 256, 10_000, 'observable outbound frame limit');
        this.pendingEmissions = bound(options.query?.maxObservablePendingEmissions, 256, 10_000, 'observable emission limit');
        this.inboundFrameBytes = bound(options.query?.maxObservableInboundFrameBytes, 64 * 1024, 16 * 1024 * 1024,
            'observable inbound frame size');
        this.outboundFrameBytes = bound(options.query?.maxObservableOutboundFrameBytes, 1024 * 1024, 16 * 1024 * 1024,
            'observable outbound frame size');
        this.tombstones = bound(options.query?.maxObservableTombstones, 1024, 100_000, 'observable tombstone limit');
        this.handshakeTimeoutMs = bound(options.query?.observableHandshakeTimeoutMs, 10_000, 120_000,
            'observable handshake timeout');
        this.shutdownTimeoutMs = bound(options.query?.observableShutdownTimeoutMs, 10_000, 120_000,
            'observable shutdown timeout');
        Object.freeze(this);
    }

    /** Include opening work; snapshot requests use a separate transient budget. */
    hasSubscriptionCapacity(active: number, opening: number, owned: number, openingOwned: number): boolean {
        return active + opening < this.subscriptions && owned + openingOwned < this.subscriptionsPerCaller;
    }
}
