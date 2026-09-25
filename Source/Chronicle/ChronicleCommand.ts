// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { defineCommand, isOutcome, rejected, validation } from '@cratis/arc.core';
import type { CommandDefinition, ExecutionContext, Outcome, ValidationResult } from '@cratis/arc.core';
import type { AppendOptions, AppendResult, EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import type { z } from 'zod';
import type { ChronicleCommandDefinition } from './ChronicleCommandDefinition.js';
import type { ChronicleProduced } from './ChronicleProduced.js';
import { waitForProjectionCompletion } from './waitForProjectionCompletion.js';

function memberName(propertyName: string): string {
    if (/^[A-Z]{2}/.test(propertyName)) return propertyName;
    return propertyName[0]!.toLowerCase() + propertyName.slice(1);
}

function appendRejection(results: readonly AppendResult[]): ValidationResult[] {
    const seen = new Set<string>();
    const issues: ValidationResult[] = [];
    for (const result of results) {
        for (const violation of result.constraintViolations) {
            const key = JSON.stringify(['constraint', violation.constraintId, violation.message, Object.entries(violation.details).sort(([a], [b]) => a.localeCompare(b))]);
            if (seen.has(key)) continue;
            seen.add(key);
            const propertyName = violation.details.PropertyName;
            issues.push({ ...validation(violation.message || violation.constraintId || 'Chronicle constraint violated',
                propertyName ? [memberName(propertyName)] : [], 'constraintViolation', 3),
                reasonDetail: violation.constraintId });
        }
        const violation = result.concurrencyViolation;
        if (violation) {
            const state = { eventSourceId: violation.eventSourceId,
                expectedEventSequenceNumber: violation.expectedSequenceNumber.value.toString(),
                actualEventSequenceNumber: violation.actualSequenceNumber.value.toString() };
            const key = JSON.stringify(['concurrency', state]);
            if (seen.has(key)) continue;
            seen.add(key);
            issues.push({ ...validation('Concurrent modification prevented the append', [], 'concurrencyViolation', 3), state });
        }
    }
    return issues;
}

/** Fail closed for transport errors, missing/mixed acknowledgments and unknown outcomes. */
export function checkResults(results: readonly AppendResult[], expected: number): Outcome<never> | undefined {
    if (results.some(result => typeof result.isSuccess !== 'boolean')) throw new Error('Chronicle returned an unknown append result');
    if (results.some(result => result.isSuccess && (result.constraintViolations.length || result.concurrencyViolation || result.errors.length))) {
        throw new Error('Chronicle returned contradictory append acknowledgment');
    }
    const accepted = results.filter(result => result.isSuccess && !result.constraintViolations.length && !result.concurrencyViolation && !result.errors.length).length;
    if (results.some(result => result.errors.length)) throw new Error('Chronicle reported an append error; persistence outcome may be partial');
    if (accepted > 0 && (accepted !== expected || results.length !== expected)) throw new Error('Chronicle reported a partial append; persisted events cannot be rolled back');
    if (results.length !== expected) throw new Error('Chronicle returned an incomplete append result');
    if (results.some(result => !result.isSuccess && !result.constraintViolations.length && !result.concurrencyViolation)) {
        throw new Error('Chronicle returned an unknown append result');
    }
    const violations = appendRejection(results);
    if (violations.length && accepted === 0) return rejected(...violations);
    if (accepted !== expected) throw new Error('Chronicle returned an unknown append result');
    return undefined;
}

export function defineChronicleCommand<S extends z.ZodType, T>(definition: ChronicleCommandDefinition<S, T>): CommandDefinition<S, T | undefined> {
    const { client, eventStore, namespaceForContext, produce, completionTimeoutMs, ...command } = definition;
    if (!eventStore) throw new Error('A Chronicle event store is required');
    return defineCommand<S, T | undefined>({
        ...command,
        async handle(input, context, provided) {
            const produced = await produce(input, context, provided);
            context.signal.throwIfAborted();
            return appendProduced(produced, context);
        }
    });

    async function appendProduced(produced: ChronicleProduced<T>, context: ExecutionContext): Promise<T | undefined | Outcome<never>> {
        const namespace = namespaceForContext(context);
        if (!namespace) throw new Error('The Chronicle namespace resolver returned no namespace');
        if (!Array.isArray(produced.events)) throw new Error('A Chronicle command must produce an event list');
        const events = produced.events.map(snapshotEvent);
        const commandResponse = produced.response;
        if (events.length && isOutcome(commandResponse)) throw new Error('A Chronicle command cannot persist events and return an Arc outcome');
        if (!events.length) return commandResponse;
        const store = await client.getEventStore(eventStore, namespace);
        for (const entry of events) {
            if (!store.eventTypes.all.some((eventType: unknown) => eventType === entry.event.constructor)) {
                throw new Error('The event type is not registered in the selected Chronicle event store');
            }
        }
        context.signal.throwIfAborted();
        const results = events.length === 1
            ? [await store.eventLog.append(events[0]!.eventSourceId, events[0]!.event, singleOptions(events[0]!, context))]
            : await store.eventLog.appendMany([...events], { correlationId: context.correlationId });
        const failure = checkResults(results, events.length);
        if (failure) return failure;
        await waitForProjectionCompletion(results, completionTimeoutMs, context.signal);
        return commandResponse;
    }
}

function snapshotEvent(entry: EventForEventSourceId): EventForEventSourceId {
    if (!entry || typeof entry !== 'object') throw new Error('A Chronicle event entry must be an object');
    const { eventSourceId, event, eventSourceType, eventStreamType, eventStreamId, subject, occurred, tags } = entry;
    if (typeof eventSourceId !== 'string' || !eventSourceId || !event || typeof event !== 'object') {
        throw new Error('Every appended event must have an event source id and a registered Chronicle event type');
    }
    return { eventSourceId, event,
        ...(eventSourceType === undefined ? {} : { eventSourceType }),
        ...(eventStreamType === undefined ? {} : { eventStreamType }),
        ...(eventStreamId === undefined ? {} : { eventStreamId }),
        ...(subject === undefined ? {} : { subject }),
        ...(tags === undefined ? {} : { tags: [...tags] }),
        ...(occurred === undefined ? {} : { occurred: new Date(occurred.getTime()) }) };
}

function singleOptions(entry: EventForEventSourceId, context: ExecutionContext): AppendOptions {
    return { correlationId: context.correlationId, sourceType: entry.eventSourceType, streamType: entry.eventStreamType,
        streamId: entry.eventStreamId, subject: entry.subject, occurred: entry.occurred, tags: entry.tags };
}
