// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcServer, serviceToken, ServiceLifetime } from '@cratis/arc.core';
import type { CommandResponseValueHandler } from '@cratis/arc.core';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { z } from 'zod';
import sinon from 'sinon';
import { defineChronicleCommand } from '../../ChronicleCommand.js';
import { accepted, executionContext, Placed } from '../given/a_command_with_typed_ports.js';

class DifferentEvent { constructor(readonly name: string) {} }

describe('when a defined Chronicle command is canceled just after append acknowledgment', () => {
    it('should not return another registered event as a successful client response or append it', async () => {
        const abort = new AbortController();
        const append = sinon.stub().callsFake(async () => {
            abort.abort(new Error('request canceled'));
            return accepted();
        });
        const store = { eventTypes: { all: [Placed, DifferentEvent] }, eventLog: { append } } as unknown as IEventStore;
        const client = { getEventStore: async () => store } as unknown as IChronicleClient;
        const definition = defineChronicleCommand({ name: 'PlaceWithEventResponse', schema: z.object({}), client,
            eventStore: 'Work', namespaceForContext: () => 'Default',
            produce: () => ({ events: [{ eventSourceId: 'source-1', event: new Placed('Ada') }], response: new DifferentEvent('wrong') }) });
        const token = serviceToken<CommandResponseValueHandler>('response handler');
        let handlerResolutions = 0;
        const server = new ArcServer({ commands: [definition], services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: () => { handlerResolutions++; return { canHandle: () => true, handle: () => {} }; } }],
        commandResponseValueHandlers: [token] });
        try {
            const result = await server.executeCommand('PlaceWithEventResponse', {}, { ...executionContext('Default'), signal: abort.signal });
            result.isSuccess.should.equal(false);
            result.exceptionMessages.should.deep.equal(['Error: request canceled']);
            (result.response === undefined).should.equal(true);
            append.calledOnce.should.equal(true);
            handlerResolutions.should.equal(0);
        } finally { await server.dispose(); }
    });
    it('should reject a response that contradicts declared client output even after an acknowledged append', async () => {
        const abort = new AbortController();
        const append = sinon.stub().callsFake(async () => {
            abort.abort(new Error('request canceled'));
            return accepted();
        });
        const store = { eventTypes: { all: [Placed] }, eventLog: { append } } as unknown as IEventStore;
        const client = { getEventStore: async () => store } as unknown as IChronicleClient;
        const definition = defineChronicleCommand({ name: 'PlaceWithInvalidOutput', schema: z.object({}), client,
            eventStore: 'Work', namespaceForContext: () => 'Default', clientOutput: { output: { kind: 'number' } },
            produce: () => ({ events: [{ eventSourceId: 'source-1', event: new Placed('Ada') }], response: 'not a number' }) });
        const server = new ArcServer({ commands: [definition] });
        try {
            const result = await server.executeCommand('PlaceWithInvalidOutput', {}, { ...executionContext('Default'), signal: abort.signal });
            result.isSuccess.should.equal(false);
            result.exceptionMessages.should.deep.equal(['Error: Declared client output does not match wire shape']);
            (result.response === undefined).should.equal(true);
            append.calledOnce.should.equal(true);
        } finally { await server.dispose(); }
    });

    it('should keep the successful response without waiting for observers', async () => {
        const abort = new AbortController();
        const completion = sinon.stub().resolves({ isSuccess: true, failedPartitions: [] });
        const append = sinon.stub().callsFake(async () => {
            abort.abort(new Error('request canceled'));
            return { ...accepted(), waitForCompletion: completion };
        });
        const store = { eventTypes: { all: [Placed] }, eventLog: { append } } as unknown as IEventStore;
        const client = { getEventStore: async () => store } as unknown as IChronicleClient;
        const definition = defineChronicleCommand({ name: 'PlaceWithWait', schema: z.object({}), client,
            eventStore: 'Work', namespaceForContext: () => 'Default', completionTimeoutMs: 3000,
            produce: () => ({ events: [{ eventSourceId: 'source-1', event: new Placed('Ada') }], response: 'done' }) });
        let handlerResolutions = 0;
        const token = serviceToken<CommandResponseValueHandler>('response handler');
        const server = new ArcServer({ commands: [definition], services: [{ token, lifetime: ServiceLifetime.Scoped,
            factory: () => { handlerResolutions++; return { canHandle: () => true, handle: () => {} }; } }],
        commandResponseValueHandlers: [token] });
        try {
            const result = await server.executeCommand('PlaceWithWait', {}, { ...executionContext('Default'), signal: abort.signal });
            result.isSuccess.should.equal(true);
            result.response!.should.equal('done');
            append.calledOnce.should.equal(true);
            completion.notCalled.should.equal(true);
            handlerResolutions.should.equal(0);
        } finally { await server.dispose(); }
    });
});
