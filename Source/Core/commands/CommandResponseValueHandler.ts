// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext } from './CommandContext.js';
import type { Outcome } from '../results/Outcome.js';
/** Consume a server-only command return value. Every matching handler processes the value. */
export interface CommandResponseValueHandler {
    /** Reject an operation journal before any response handlers stage irreversible effects. */
    readonly incompatibleWithOperations?: boolean;
    canHandle(context: CommandContext, value: unknown): boolean;
    handle(context: CommandContext, value: unknown): void | Outcome<unknown> | Promise<void | Outcome<unknown>>;
}
