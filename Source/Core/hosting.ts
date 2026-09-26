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
/** Integration-only. Applications must not call this; it lets a trusted integration acknowledge an inline commit before cancellation can discard its response. */
export { acknowledgeCommandCommit } from './commands/acknowledgeCommandCommit.js';
/** Integration-only. Applications must not call this; it lets a trusted integration mark a command whose handler commits inline. */
export { inlineCommitClientResponse } from './commands/CommandDefinition.js';
/** Integration-only. Applications must not call this; it lets a trusted integration recognize operation declarations across copies of Core. */
export { isCommandOperation } from './commands/CommandOperation.js';
/** Integration-only. Applications must not call this; it lets a trusted integration recognize operation batches across copies of Core. */
export { isCommandOperations } from './commands/CommandOperations.js';
/** Integration-only. Applications must not call this; it lets a trusted integration recognize branded tuples across copies of Core. */
export { isArcTuple } from './commands/ArcTuple.js';
/** Integration-only. Applications must not call this; it lets a trusted integration flatten responses exactly as Core will flatten them. */
export { flattenCommandResponse } from './commands/processCommandResponse.js';
/** Preserve the original integration failure for host-side diagnostics and cleanup. */
export { recordFailure } from './execution/failureTracking.js';
export { ObservableHandshakeTimeoutError, withObservableHandshakeTimeout } from './queries/observable/withObservableHandshakeTimeout.js';
