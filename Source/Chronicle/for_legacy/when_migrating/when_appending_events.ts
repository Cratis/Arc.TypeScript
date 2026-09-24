// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, should, it, vi } from 'vitest';
import { z } from 'zod';
import { ArcServer, Severity, denied, rejected, response, validation } from '@cratis/arc.core';
import type { ExecutionContext, Outcome } from '@cratis/arc.core';
import type { AppendResult, EventForEventSourceId, EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import type { IEventTypes } from '@cratis/chronicle/events';
import { defineChronicleCommand } from '../../index.js';

should();

class Placed { constructor(readonly name: string) {} }
class NotRegistered { constructor(readonly name: string) {} }
const sequenceNumber = (value: bigint): EventSequenceNumber => ({ value, isBefore: other => value < other.value, isAfter: other => value > other.value, toString: () => value.toString() });
const context = (tenantId: string, correlationId = crypto.randomUUID()): ExecutionContext => ({ tenantId, correlationId, principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning });
const accepted = (): AppendResult => ({ sequenceNumber: sequenceNumber(1n), constraintViolations: [], errors: [], isSuccess: true, waitForCompletion: async () => ({ isSuccess: true, failedPartitions: [] }) });
const constraint = (): AppendResult => ({ ...accepted(), isSuccess: false, constraintViolations: [{ constraintId: 'unique', message: 'already taken', details: {} }] });
const concurrency = (): AppendResult => ({ ...accepted(), isSuccess: false, concurrencyViolation: { eventSourceId: 'a', expectedSequenceNumber: sequenceNumber(1n), actualSequenceNumber: sequenceNumber(2n) } });

const setup = (
    result: () => Promise<AppendResult[]>,
    create: () => EventForEventSourceId[] = () => [{ eventSourceId: 'a', event: new Placed('first'), subject: 'person-1', eventStreamType: 'tasks', tags: ['created'] }],
    registered: IEventTypes['all'] = [Placed],
    producedResponse: string | Outcome<string> = 'done'
) => {
    const appendMany = vi.fn(async (events: object[], options: object) => { void events; void options; return result(); });
    const append = vi.fn(async (sourceId: string, event: object, options: object) => {
        void sourceId; void event; void options;
        const results = await result();
        if (results.length !== 1) throw new Error('Single append did not return one result');
        return results[0]!;
    });
    const eventTypes = { all: registered } satisfies Pick<IEventTypes, 'all'>;
    const getEventStore = vi.fn(async (store: string, tenant: string) => {
        void store; void tenant;
        return { eventLog: { append, appendMany }, eventTypes } as unknown as IEventStore;
    });
    const client = { getEventStore } as unknown as IChronicleClient;
    const command = defineChronicleCommand({ name: 'Place', schema: z.object({}), client, eventStore: 'Tasks', namespaceForContext: ctx => ctx.tenantId ?? '', produce: () => ({ events: create(), response: producedResponse }) });
    return { command, append, appendMany, getEventStore };
};

class when_appending_events {
    static async should_pass_parallel_namespaces_correlation_and_metadata_without_leaking_events() {
        const { command, append, getEventStore } = setup(async () => [accepted()]);
        const server = new ArcServer({ commands: [command] });
        const a = context('a');
        const b = context('b');
        const results = await Promise.all([server.executeCommand('Place', {}, a), server.executeCommand('Place', {}, b)]);
        (results.map(result => result.response)).should.deep.equal(['done', 'done']);
        (getEventStore.mock.calls).should.deep.equal([['Tasks', 'a'], ['Tasks', 'b']]);
        (append.mock.calls.map(call => call[0])).should.deep.equal(['a', 'a']);
        (append.mock.calls.map(call => call[1])).should.deep.equal([new Placed('first'), new Placed('first')]);
        append.mock.calls.should.have.lengthOf(2);
        append.mock.calls[0]![2].should.deep.include({ correlationId: a.correlationId, subject: 'person-1', streamType: 'tasks', tags: ['created'] });
        append.mock.calls[1]![2].should.deep.include({ correlationId: b.correlationId, subject: 'person-1', streamType: 'tasks', tags: ['created'] });
    }

    static async should_allow_empty_events_only_with_resolved_namespace() {
        const { command, getEventStore } = setup(async () => [], () => []);
        const server = new ArcServer({ commands: [command] });
        should().equal((await server.executeCommand('Place', {}, context('a'))).response, 'done');
        const unresolved = await server.executeCommand('Place', {}, context(''));
        (unresolved.hasExceptions).should.equal(true);
        should().equal(unresolved.response, undefined);
        getEventStore.mock.calls.should.have.lengthOf(0);
    }

    static async should_use_batch_metadata_and_fail_closed_on_synthetic_mixed_results() {
        const events = () => [
            { eventSourceId: 'a', event: new Placed('first'), subject: 'subject-a' },
            { eventSourceId: 'b', event: new Placed('second'), eventStreamId: 'stream-b' }
        ];
        const success = setup(async () => [accepted(), accepted()], events);
        const result = await new ArcServer({ commands: [success.command] }).executeCommand('Place', {}, context('a'));
        should().equal(result.response, 'done');
        success.appendMany.mock.calls[0]![0].should.deep.equal(events());
        success.appendMany.mock.calls[0]![1].should.have.all.keys('correlationId');
        success.appendMany.mock.calls[0]![1].should.have.property('correlationId').that.is.a('string');
        const partial = setup(async () => [accepted(), constraint()], events);
        const failure = await new ArcServer({ commands: [partial.command] }).executeCommand('Place', {}, context('a'));
        (failure.hasExceptions).should.equal(true);
        should().equal(failure.response, undefined);
        // Synthetic complete results: the published SDK does not retain rejection details for appendMany.
        const rejectedBatch = setup(async () => [constraint(), constraint()], events);
        const rejected = await new ArcServer({ commands: [rejectedBatch.command] }).executeCommand('Place', {}, context('a'));
        (rejected.hasExceptions).should.equal(false);
        (rejected.validationResults.map(issue => issue.reason)).should.deep.equal(['constraintViolation']);
        should().equal(rejected.response, undefined);
        const distinct = setup(async () => [constraint(), { ...constraint(), constraintViolations: [{ constraintId: 'other', message: 'taken', details: {} }] }], events);
        const distinctResult = await new ArcServer({ commands: [distinct.command] }).executeCommand('Place', {}, context('a'));
        (distinctResult.validationResults.map(issue => issue.reasonDetail)).should.deep.equal(['unique', 'other']);
    }

    static async should_map_structured_single_append_rejections() {
        const detail = { ...constraint(), constraintViolations: [{ constraintId: 'unique', message: '', details: { PropertyName: 'FirstName' } }] };
        const first = setup(async () => [detail]);
        const constraintResult = await new ArcServer({ commands: [first.command] }).executeCommand('Place', {}, context('a'));
        (constraintResult.isSuccess).should.equal(false);
        should().equal(constraintResult.response, undefined);
        constraintResult.validationResults.should.have.lengthOf(1);
        constraintResult.validationResults[0]!.should.deep.include({ reason: 'constraintViolation', reasonDetail: 'unique', message: 'unique', members: ['firstName'] });
        const acronym = setup(async () => [{ ...constraint(), constraintViolations: [{ constraintId: 'acronym', message: 'taken', details: { PropertyName: 'URL' } }] }]);
        const acronymResult = await new ArcServer({ commands: [acronym.command] }).executeCommand('Place', {}, context('a'));
        acronymResult.validationResults[0]!.members.should.deep.equal(['URL']);
        const expected = sequenceNumber(9007199254740993n);
        const actual = sequenceNumber(9007199254740995n);
        const second = setup(async () => [{ ...concurrency(), concurrencyViolation: { eventSourceId: 'a', expectedSequenceNumber: expected, actualSequenceNumber: actual } }]);
        const concurrencyResult = await new ArcServer({ commands: [second.command] }).executeCommand('Place', {}, context('a'));
        concurrencyResult.validationResults.should.have.lengthOf(1);
        concurrencyResult.validationResults[0]!.should.have.property('reason', 'concurrencyViolation');
        should().exist(concurrencyResult.validationResults[0]!.state);
        (concurrencyResult.validationResults[0]!.state as object).should.deep.include({
            eventSourceId: 'a', expectedEventSequenceNumber: '9007199254740993', actualEventSequenceNumber: '9007199254740995'
        });
        (() => JSON.stringify(concurrencyResult)).should.not.throw();
        should().equal(concurrencyResult.response, undefined);
    }

    static async should_fail_closed_on_unknown_missing_error_and_throw() {
        const cases: Array<() => Promise<AppendResult[]>> = [
            async () => [{ ...accepted(), isSuccess: false }],
            async () => [{ ...accepted(), isSuccess: 'true' as unknown as boolean }],
            async () => [{ ...constraint(), isSuccess: true }],
            async () => [{ ...concurrency(), isSuccess: true }],
            async () => [{ ...accepted(), errors: [{ message: 'bad' }] }],
            async () => { throw new Error('transport'); }
        ];
        for (const result of cases) {
            const { command } = setup(result);
            const response = await new ArcServer({ commands: [command] }).executeCommand('Place', {}, context('a'));
            (response.hasExceptions).should.equal(true);
            should().equal(response.response, undefined);
        }
        const events = () => [{ eventSourceId: 'a', event: new Placed('first') }, { eventSourceId: 'a', event: new Placed('second') }];
        for (const result of [async () => [accepted()], async () => [], async () => [constraint(), { ...accepted(), isSuccess: false }]]) {
            const { command, appendMany } = setup(result, events);
            const response = await new ArcServer({ commands: [command] }).executeCommand('Place', {}, context('a'));
            (response.hasExceptions).should.equal(true);
            should().equal(response.response, undefined);
            appendMany.mock.calls.should.have.lengthOf(1);
        }
    }

    static async should_treat_published_empty_batch_results_as_unknown_not_a_constraint_verdict() {
        // The published 6.2 SDK maps appendMany SequenceNumbers to results; rejected batches produce [].
        const batch = setup(async () => [], () => [
            { eventSourceId: 'a', event: new Placed('first') }, { eventSourceId: 'a', event: new Placed('second') }
        ]);
        const outcome = await new ArcServer({ commands: [batch.command] }).executeCommand('Place', {}, context('a'));
        batch.appendMany.mock.calls.should.have.lengthOf(1);
        (outcome.hasExceptions).should.equal(true);
        (outcome.isSuccess).should.equal(false);
        (outcome.validationResults).should.deep.equal([]);
        should().equal(outcome.response, undefined);
    }

    static async should_reject_branded_response_before_any_persistence() {
        for (const outcome of [rejected(validation('bad')), denied('no access'), response('value')]) {
            const { command, append, getEventStore } = setup(async () => [accepted()], undefined, [Placed], outcome);
            const result = await new ArcServer({ commands: [command] }).executeCommand('Place', {}, context('a'));
            (result.hasExceptions).should.equal(true);
            should().equal(result.response, undefined);
            append.mock.calls.should.have.lengthOf(0);
            getEventStore.mock.calls.should.have.lengthOf(0);
        }
        const noEvents = setup(async () => [], () => [], [Placed], denied('no access'));
        const denial = await new ArcServer({ commands: [noEvents.command] }).executeCommand('Place', {}, context('a'));
        (denial.isAuthorized).should.equal(false);
        noEvents.getEventStore.mock.calls.should.have.lengthOf(0);
    }

    static async should_abort_before_persistence_and_not_invent_rollback_after_ack() {
        const duringProduce = new AbortController();
        const beforeProduce = setup(async () => [accepted()], () => { duringProduce.abort(); return [{ eventSourceId: 'a', event: new Placed('first') }]; });
        const first = await new ArcServer({ commands: [beforeProduce.command] }).executeCommand('Place', {}, { ...context('a'), signal: duringProduce.signal });
        (first.hasExceptions).should.equal(true);
        beforeProduce.getEventStore.mock.calls.should.have.lengthOf(0);
        beforeProduce.append.mock.calls.should.have.lengthOf(0);

        const duringStore = new AbortController();
        const afterStore = setup(async () => [accepted()]);
        afterStore.getEventStore.mockImplementationOnce(async () => {
            duringStore.abort();
            return { eventTypes: { all: [Placed] }, eventLog: { append: afterStore.append, appendMany: afterStore.appendMany } } as unknown as IEventStore;
        });
        const second = await new ArcServer({ commands: [afterStore.command] }).executeCommand('Place', {}, { ...context('a'), signal: duringStore.signal });
        (second.hasExceptions).should.equal(true);
        afterStore.append.mock.calls.should.have.lengthOf(0);

        const afterAck = new AbortController();
        const persisted = setup(async () => { afterAck.abort(); return [accepted()]; });
        const third = await new ArcServer({ commands: [persisted.command] }).executeCommand('Place', {}, { ...context('a'), signal: afterAck.signal });
        persisted.append.mock.calls.should.have.lengthOf(1);
        should().equal(third.response, 'done');
        (third.isSuccess).should.equal(true);
    }

    static async should_reject_types_not_registered_in_selected_store() {
        const { command, append, getEventStore } = setup(async () => [accepted()], () => [{ eventSourceId: 'a', event: new NotRegistered('other') }]);
        const result = await new ArcServer({ commands: [command] }).executeCommand('Place', {}, context('a'));
        (result.hasExceptions).should.equal(true);
        getEventStore.mock.calls.should.deep.include(['Tasks', 'a']);
        append.mock.calls.should.have.lengthOf(0);
        const batch = setup(async () => [accepted(), accepted()], () => [
            { eventSourceId: 'a', event: new Placed('first') }, { eventSourceId: 'b', event: new NotRegistered('second') }
        ]);
        const rejected = await new ArcServer({ commands: [batch.command] }).executeCommand('Place', {}, context('b'));
        (rejected.hasExceptions).should.equal(true);
        batch.getEventStore.mock.calls.should.deep.include(['Tasks', 'b']);
        batch.appendMany.mock.calls.should.have.lengthOf(0);
    }
}

describe('when appending Chronicle events through public typed ports', () => {
    it('should pass parallel namespaces, correlation and metadata without leaking events', when_appending_events.should_pass_parallel_namespaces_correlation_and_metadata_without_leaking_events);
    it('should allow empty events only with resolved namespace', when_appending_events.should_allow_empty_events_only_with_resolved_namespace);
    it('should use batch metadata and fail closed on synthetic mixed results', when_appending_events.should_use_batch_metadata_and_fail_closed_on_synthetic_mixed_results);
    it('should map structured single append rejections', when_appending_events.should_map_structured_single_append_rejections);
    it('should fail closed on unknown, missing, error and throw', when_appending_events.should_fail_closed_on_unknown_missing_error_and_throw);
    it('should treat published empty batch results as unknown, not a constraint verdict', when_appending_events.should_treat_published_empty_batch_results_as_unknown_not_a_constraint_verdict);
    it('should reject branded responses before any persistence', when_appending_events.should_reject_branded_response_before_any_persistence);
    it('should abort before persistence without inventing rollback after acknowledgment', when_appending_events.should_abort_before_persistence_and_not_invent_rollback_after_ack);
    it('should reject types not registered in selected store', when_appending_events.should_reject_types_not_registered_in_selected_store);
});
