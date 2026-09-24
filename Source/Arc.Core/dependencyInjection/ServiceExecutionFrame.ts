// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceExecutionState } from './ServiceExecutionState.js';
/** Internal execution ancestry for safe shutdown after a detached nested pipeline. */
export interface ServiceExecutionFrame {
    readonly completion: Promise<void>;
    readonly parent: ServiceExecutionFrame | undefined;
    state: ServiceExecutionState;
}
