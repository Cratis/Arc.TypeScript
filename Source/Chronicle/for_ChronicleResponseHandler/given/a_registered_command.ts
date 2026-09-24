// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { ArcApplication, command, key, Severity, tuple, rejected, validation } from '@cratis/arc.core';
import type { ExecutionContext } from '@cratis/arc.core';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import type { AppendResult, EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import sinon from 'sinon';
import { accepted } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';
import '../../index.js';

@eventType()
export class Created { @field(String) name = ''; }
@command()
export class Create {
    @field(String) @key() id = '';
    @field(String) name = '';
    handle(): Created { return Object.assign(new Created(), { name: this.name }); }
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
export class ReturnData {
    @field(String) name = '';
    handle(): object[] { return [{ name: this.name }]; }
}
@command()
export class CreateWithResponse {
    @field(String) name = '';
    handle() { return tuple('created-1', Object.assign(new Created(), { name: this.name })); }
}
export const context = (tenantId = 'one'): ExecutionContext => ({ tenantId, correlationId: crypto.randomUUID(),
    principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning });

export class a_registered_command {
    readonly appendMany = sinon.stub().callsFake(async (entries: EventForEventSourceId[]): Promise<AppendResult[]> => entries.map(() => accepted()));
    readonly getEventStore = sinon.stub().callsFake(async (): Promise<IEventStore> =>
        ({ eventTypes: { all: [Created] }, eventLog: { appendMany: this.appendMany } }) as unknown as IEventStore);
    async build() {
        const builder = ArcApplication.createBuilder();
        builder.addChronicle({ eventStore: 'Tasks', client: { getEventStore: this.getEventStore } as unknown as IChronicleClient });
        builder.add(Create, CreateWithResponse, CreateRejected, CreateMany, ReturnData, Created);
        return builder.build();
    }
}
