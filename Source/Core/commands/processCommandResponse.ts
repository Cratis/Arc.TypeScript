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
/** Preserve a completed handler's effect-free outcome without admitting response-handler stages. */
export function completedCommandResponse(context: CommandContext, leaves: readonly unknown[], handlersRegistered: boolean): CommandResult | undefined {
    if (leaves.some(value => Array.isArray(value) && value.some(isCommandOperation)))
        throw new Error('Use CommandOperations instead of returning an ordinary collection of operation declarations');
    if (leaves.some(value => isCommandOperation(value) || isCommandOperations(value))) return undefined;
    const ordinary = leaves.filter(value => !control(value));
    if (handlersRegistered && ordinary.length) return undefined; // Only real handlers can classify ordinary values.
    if (ordinary.length > 1) throw new Error('Multiple unhandled command response values');
    const validation = leaves.filter(control).flatMap(value => value.kind === 'validation' ?
        value.results.filter(item => item.severity > context.allowedSeverity) : []);
    const denial = leaves.filter(control).find(value => value.kind === 'denied');
    return commandResult(context, { response: ordinary[0], isAuthorized: !denial,
        authorizationFailureReason: denial?.kind === 'denied' ? denial.reason : undefined, validationResults: validation });
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
    if (!operationsPresent || authorized && !validation.length) outer: for (let index = 0; index < ordinary.length; index++) {
        const value = ordinary[index];
        if (control(value) || value === context.response) continue;
        const matched = matching.get(value) ?? [];
        for (let handlerIndex = 0; handlerIndex < matched.length; handlerIndex++) {
            throwIfCanceled(context, 'Command canceled');
            const handled = await matched[handlerIndex]!.handle(context, value);
            // An acknowledged handler has completed its effect. Keep that result only when no
            // remaining matching invocation would be skipped by cancellation.
            if (context.signal.aborted && hasAcknowledgedCommandCommit(context) && !isOutcome(handled)) {
                const remaining = ordinary.slice(index + 1).some(next =>
                    !control(next) && next !== context.response && (matching.get(next)?.length ?? 0) > 0);
                if (handlerIndex === matched.length - 1 && !remaining) break outer;
            }
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
    if (context.signal.aborted && !hasAcknowledgedCommandCommit(context)) throwIfCanceled(context, 'Command canceled');
    return commandResult(context, { response: context.response, isAuthorized: authorized,
        authorizationFailureReason: reason, validationResults: validation, exceptionMessages: failures });
}
