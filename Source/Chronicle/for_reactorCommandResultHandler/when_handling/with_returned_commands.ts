// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '@cratis/arc.core';
import type { ArcServer } from '@cratis/arc.core';
import type { EventContext } from '@cratis/chronicle/events';
import { eventType } from '@cratis/chronicle/events';
import { causationManager } from '@cratis/chronicle/auditing';
import { reactorCommandResultHandler, executeCommandsAsSystem } from '../../reactorCommands.js';

@command() class FollowUp { handle(): void {} }
@eventType() class Event { }
@executeCommandsAsSystem('writers') class SystemReactor {}
class OrdinaryReactor {}
const context = { eventSourceId: 'source', sequenceNumber: 42n, eventType: { id: { value: 'event-type' } },
    correlationId: 'correlation' } as EventContext;

describe('when handling returned reactor commands', () => {
    it('should execute each command in the event namespace with a system principal when requested', async () => {
        const seen: unknown[] = [];
        const server = { execute: async (value: object, execution: unknown) => {
            seen.push({ value, execution, causation: causationManager.getCurrentChain() });
            return { isSuccess: true };
        } } as ArcServer;
        const result = await reactorCommandResultHandler(() => server)([new FollowUp(), new FollowUp()], context, SystemReactor, 'store', 'tenant');
        result.should.equal(true);
        seen.should.have.lengthOf(2);
        const execution = (seen[0] as { execution: { tenantId: string; correlationId: string; principal: { roles: string[] } } }).execution;
        execution.tenantId.should.equal('tenant');
        execution.correlationId.should.equal('correlation');
        execution.principal.roles.should.deep.equal(['writers']);
        (seen[0] as { causation: { properties: Record<string, string> }[] }).causation.at(-1)!.properties.sequenceNumber!.should.equal('42');
    });
    it('should fail the reactor when a command is rejected, without running later commands', async () => {
        let attempts = 0;
        const server = { execute: async () => { attempts++; return { isSuccess: false, validationResults: [{ message: 'denied' }],
            exceptionMessages: [], isAuthorized: true }; } } as unknown as ArcServer;
        let error: unknown;
        try { await reactorCommandResultHandler(() => server)([new FollowUp(), new FollowUp()], context, OrdinaryReactor, 'store', 'tenant'); }
        catch (thrown) { error = thrown; }
        (error as Error).message.should.contain('denied');
        attempts.should.equal(1);
    });
    it('should reject mixed event and command returns before running any command', async () => {
        let attempted = false;
        const server = { execute: async () => { attempted = true; } } as unknown as ArcServer;
        let error: unknown;
        try { await reactorCommandResultHandler(() => server)([new Event(), new FollowUp()], context, OrdinaryReactor, 'store', 'tenant'); }
        catch (thrown) { error = thrown; }
        (error as Error).message.should.contain('mix');
        attempted.should.equal(false);
    });
    it('should leave event-only results for the SDK to append', async () => {
        const result = await reactorCommandResultHandler(() => { throw new Error('server must not be used'); })(
            new Event(), context, OrdinaryReactor, 'store', 'tenant');
        result.should.equal(false);
    });
});
