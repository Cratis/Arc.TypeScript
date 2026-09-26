// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../execution/ExecutionContext.js';

const acknowledged = new WeakSet<ExecutionContext>();

/** Integration-only: record an irreversible inline commit after the provider acknowledges it. */
export function acknowledgeCommandCommit(context: ExecutionContext): void { acknowledged.add(context); }

/** Whether this command already has an acknowledged inline commit that cancellation cannot undo. */
export function hasAcknowledgedCommandCommit(context: ExecutionContext): boolean { return acknowledged.has(context); }
