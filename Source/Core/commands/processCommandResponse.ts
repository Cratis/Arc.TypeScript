// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { isArcTuple } from './ArcTuple.js';
import { throwIfCanceled } from '../execution/throwIfCanceled.js';
import { hasAcknowledgedCommandCommit } from './acknowledgeCommandCommit.js';
import { isOutcome, type Outcome } from './Outcome.js';
import { commandResult } from './createCommandResult.js';
import type { CommandResult } from './CommandResult.js';
import type { CommandContext } from './CommandContext.js';
import { isCommandOperation } from './CommandOperation.js';
import { isCommandOperations } from './CommandOperations.js';
import type { CommandResponseValueHandler } from './CommandResponseValueHandler.js';

/** Flatten only branded tuples and selected response branches, never ordinary arrays. */
export function flattenCommandResponse(value: unknown): unknown[] {
    if (value === null || value === undefined) return [];
    if (isArcTuple(value)) return value.values.flatMap(flattenCommandResponse);
    if (isOutcome(value) && value.kind === 'response') return flattenCommandResponse(value.value);
    return [value];
}
function control(value: unknown): value is Outcome<unknown> {
    return isOutcome(value) && value.kind !== 'response';
}
/** Classify all leaves before invoking any handlers or operation effects. */
export async function processCommandResponse(context: CommandContext, leaves: readonly unknown[],
    handlers: readonly CommandResponseValueHandler[], operationsPresent: boolean): Promise<CommandResult> {
    const ordinary = leaves.filter(value => !isCommandOperation(value) && !isCommandOperations(value));
    if (leaves.some(value => Array.isArray(value) && value.some(isCommandOperation)))
        throw new Error('Use CommandOperations instead of returning an ordinary collection of operation declarations');
    const matching = new Map<unknown, CommandResponseValueHandler[]>();
    for (const value of ordinary) if (!control(value)) {
        const matches: CommandResponseValueHandler[] = [];
        for (const handler of handlers) {
            if (context.signal.aborted && hasAcknowledgedCommandCommit(context)) break;
            throwIfCanceled(context, 'Command canceled');
            const canHandle = await handler.canHandle(context, value);
            throwIfCanceled(context, 'Command canceled');
            if (canHandle) matches.push(handler);
        }
        matching.set(value, matches);
    }
    // Control signals precede effectful handlers when operations participate.
    const values = operationsPresent ? [...ordinary.filter(control), ...ordinary.filter(value => !control(value))] : ordinary;
    for (const value of values) {
        throwIfCanceled(context, 'Command canceled');
        if (control(value)) continue;
        if (!matching.get(value)?.length) {
            if (context.response !== undefined) throw new Error('Multiple unhandled command response values');
            context.response = value;
        }
    }
    const failures: string[] = [];
    let authorized = true;
    let reason = '';
    const validation = [];
    for (const value of values) {
        throwIfCanceled(context, 'Command canceled');
        if (!control(value)) continue;
        if (value.kind === 'denied') { authorized = false; reason = value.reason ?? ''; }
        else if (value.kind === 'validation') validation.push(...value.results.filter(item => item.severity > context.allowedSeverity));
    }
    if (!operationsPresent || authorized && !validation.length) outer: for (const value of ordinary) {
        if (control(value) || value === context.response) continue;
        for (const handler of matching.get(value) ?? []) {
            if (context.signal.aborted && hasAcknowledgedCommandCommit(context)) break outer;
            throwIfCanceled(context, 'Command canceled');
            const handled = await handler.handle(context, value);
            if (!isOutcome(handled) && context.signal.aborted && hasAcknowledgedCommandCommit(context)) break outer;
            throwIfCanceled(context, 'Command canceled');
            if (!isOutcome(handled)) continue;
            if (handled.kind === 'denied') { authorized = false; reason = handled.reason ?? ''; break outer; }
            if (handled.kind === 'validation') {
                validation.push(...handled.results.filter(item => item.severity > context.allowedSeverity));
                if (validation.length) break outer;
            } else {
                failures.push('Response value handlers cannot return client responses');
                break outer;
            }
        }
    }
    throwIfCanceled(context, 'Command canceled');
    return commandResult(context, { response: context.response, isAuthorized: authorized,
        authorizationFailureReason: reason, validationResults: validation, exceptionMessages: failures });
}
