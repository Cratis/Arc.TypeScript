// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcServer } from './ArcServer.js';

/** Resolve a low-level Arc server from a built application or server instance. */
export function serverOf(application: ArcServer | { readonly server: ArcServer }): ArcServer {
    return 'server' in application ? application.server : application;
}

/** Node hosting integration points; adapters own trusted native context resolution. */
export { attachNodeWebSockets } from './queries/observable/attachNodeWebSockets.js';
export { serveUpgradedSocket } from './queries/observable/serveUpgradedSocket.js';
export { observableLimits } from './queries/observable/observableHosting.js';
export type { NodeWebSocketLike } from './queries/observable/NodeWebSocketLike.js';
export { prepareObservableUpgrade } from './queries/observable/prepareObservableUpgrade.js';
/** Preserve the original integration failure for host-side diagnostics and cleanup. */
export { recordFailure } from './execution/failureTracking.js';
export { ObservableHandshakeTimeoutError, withObservableHandshakeTimeout } from './queries/observable/withObservableHandshakeTimeout.js';
