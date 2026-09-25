// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { NativeRequestContext } from '../http/NativeRequestContext.js';
import type { ServiceToken } from '../dependencyInjection/ServiceToken.js';
import type { ObservableEmissionGuard } from './observable/ObservableEmissionGuard.js';

/** Query transport settings; all durations are milliseconds in TypeScript. */
export interface ObservableQueryOptions {
    /** Maximum simultaneous subscriptions; defaults to 4096. */
    maxObservableSubscriptions?: number;
    /** Maximum simultaneous subscriptions per caller; defaults to 4096. */
    maxObservableSubscriptionsPerCaller?: number;
    /** Maximum physical hub connections; defaults to 512. */
    maxObservableHubConnections?: number;
    /** Maximum hub connections per caller; defaults to 512. */
    maxObservableHubConnectionsPerCaller?: number;
    /** Maximum subscriptions per hub connection; defaults to 256. */
    maxObservableHubSubscriptionsPerConnection?: number;
    /** Maximum queued inbound frames; defaults to 256. */
    maxObservableInboundFrames?: number;
    /** Maximum queued outbound frames; defaults to 256. */
    maxObservableOutboundFrames?: number;
    /** Maximum pending emissions; defaults to 256. */
    maxObservablePendingEmissions?: number;
    /** Maximum incoming WebSocket frame or SSE control body in bytes; defaults to 64 KiB. */
    maxObservableInboundFrameBytes?: number;
    /** Maximum outgoing frame size in bytes; defaults to 1 MiB. */
    maxObservableOutboundFrameBytes?: number;
    /** Maximum retained unsubscribe tombstones; defaults to 1024. */
    maxObservableTombstones?: number;
    /** WebSocket upgrade handshake deadline; defaults to 10 seconds. */
    observableHandshakeTimeoutMs?: number;
    /** Shutdown deadline for joining hub subscriptions; defaults to 10 seconds. */
    observableShutdownTimeoutMs?: number;
    /** Idle keep-alive cadence; zero disables it, default 30 seconds. */
    keepAliveIntervalMs?: number;
    /** Trusted HTTP or HTTPS Origins for WebSocket and SSE control requests. */
    allowedOrigins?: readonly string[] | ((origin: string, request: Request, native?: NativeRequestContext) => boolean | Promise<boolean>);
    /** Expose caller-scoped observable query health; disabled by default. */
    enableObservableHealth?: boolean;
    /** Ordered scoped guards applied to each observable emission. */
    observableEmissionGuards?: readonly ServiceToken<ObservableEmissionGuard>[];
}
