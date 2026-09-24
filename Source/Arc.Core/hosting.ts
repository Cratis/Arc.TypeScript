// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Node hosting integration points; adapters own trusted native context resolution. */
export { attachNodeWebSockets } from './queries/observable/attachNodeWebSockets.js';
export { serveUpgradedSocket } from './queries/observable/serveUpgradedSocket.js';
export { observableLimits } from './queries/observable/observableHosting.js';
export type { NodeWebSocketLike } from './queries/observable/NodeWebSocketLike.js';
export { prepareObservableUpgrade } from './queries/observable/prepareObservableUpgrade.js';
export { ObservableHandshakeTimeoutError, withObservableHandshakeTimeout } from './queries/observable/withObservableHandshakeTimeout.js';
