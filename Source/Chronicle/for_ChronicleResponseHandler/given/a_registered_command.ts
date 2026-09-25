// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { pii } from '@cratis/chronicle/compliance';
import { ArcApplication, CommandOperation, command, key, Severity, tuple, rejected, validation } from '@cratis/arc.core';
import type { ExecutionContext } from '@cratis/arc.core';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import type { AppendResult, EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import sinon from 'sinon';
import { accepted } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';
import { eventSourceIdResponse, notAudited } from '../../index.js';

@eventType()
export class Created { @field(String) name: string; constructor(name = '') { this.name = name; } }
@command()
export class Create {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle(): Created { return new Created(this.name); }
}
@command()
export class CreateRejected {
    @field(String) @key() id = '';
    handle() { return rejected(validation('Denied')); }
}
@command()
export class CreateMany {
    @field(String) @key() id = '';
    handle(): Created[] { return [new Created(), new Created()]; }
}
@command()
export class CreateMixed {
    @field(String) @key() id = '';
    handle() { return [new Created(), { message: 'ordinary response' }]; }
}
@command()
export class CreateEmpty {
    @field(String) @key() id = '';
    handle(): Created[] { return []; }
}
@command()
export class ReturnData {
    @field(String) name = '';
    handle(): object[] { return [{ name: this.name }]; }
}
@command()
export class ReturnEventShapedData {
    @field(String) @key() id = '';
    handle() { return { event: { name: 'not registered' }, eventSourceId: 'not-a-stream' }; }
}
@command()
export class CreateWithResponse {
    @field(String) name = '';
    handle() { return tuple(eventSourceIdResponse('created-1'), new Created(this.name)); }
}
export let operationExecuted = false;
export let operationCompensated = false;
class TestOperation extends CommandOperation {
    execute(signal: AbortSignal) { signal.throwIfAborted(); operationExecuted = true; }
    compensate(failure: unknown, signal: AbortSignal) { void failure; signal.throwIfAborted(); operationCompensated = true; }
}
@command()
export class CreateWithOperation {
    @field(String) @key() id = '';
    handle() { operationExecuted = false; operationCompensated = false; return tuple(new Created(), new TestOperation()); }
}
@command()
export class CreateSensitive {
    @field(String) @key() id = '';
    @field(String) @notAudited() confirmation = '';
    @field(String) @pii('personal name') personalName = '';
    handle(): Created { return new Created(); }
}
@command()
export class CreateWithMessage {
    @field(String) @key() id = '';
    handle() { return tuple(new Created(), 'Task created'); }
}
export const context = (tenantId = 'one'): ExecutionContext => ({ tenantId, correlationId: crypto.randomUUID(),
    principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning });

export class a_registered_command {
    readonly appendMany = sinon.stub().callsFake(async (entries: EventForEventSourceId[]): Promise<AppendResult[]> => entries.map(() => accepted()));
    readonly getEventStore = sinon.stub().callsFake(async (): Promise<IEventStore> =>
        ({ eventTypes: { all: [Created] }, eventLog: { appendMany: this.appendMany } }) as unknown as IEventStore);
    async build() {
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Tasks', client: { getEventStore: this.getEventStore } as unknown as IChronicleClient });
        builder.add(Create, CreateWithResponse, CreateWithMessage, CreateWithOperation, CreateSensitive, CreateRejected, CreateMany, CreateMixed, CreateEmpty, ReturnData, ReturnEventShapedData, Created);
        return builder.build();
    }
}
