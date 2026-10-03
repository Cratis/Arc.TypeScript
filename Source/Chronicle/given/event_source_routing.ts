// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { ConcurrencyDimensions, eventSource, eventStream, getEventSourceMetadata, getEventStreamsFor } from '@cratis/chronicle';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { EventSequenceNumber } from '@cratis/chronicle/eventSequences';
import type { AppendResult, EventForEventSourceId } from '@cratis/chronicle/eventSequences';
import { ArcApplication, command, inject, key } from '@cratis/arc.core';
import sinon from 'sinon';
import { AggregateRoot, commandAggregate, eventForEventSourceId, eventSourceDefinition, eventSourceType, eventStreamId, eventStreamType } from '../index.js';
import { Created } from '../for_ChronicleResponseHandler/given/a_registered_command.js';
import { accepted } from '../for_ChronicleCommand/given/a_command_with_typed_ports.js';

@eventSource()
@eventStream('Transactions', { concurrency: ConcurrencyDimensions.eventStreamType | ConcurrencyDimensions.eventStreamId })
@eventStream('Statements')
export class Account {}
@eventSource()
@eventStream('Postings')
export class Ledger {}
export class NotADefinition {}

@eventSourceDefinition(Account, 'Transactions') @command()
export class Deposit { @field(String) @key() id = ''; handle(): Created { return new Created(); } }
@eventSourceDefinition(() => Account, 'Transactions') @command()
export class DepositLazily { @field(String) @key() id = ''; handle(): Created { return new Created(); } }
@eventSourceDefinition('Account') @command()
export class DepositByName { @field(String) @key() id = ''; handle(): Created { return new Created(); } }
@eventSourceDefinition(Account, 'Transactions') @command()
export class PostToLedger {
    @field(String) @key() id = '';
    handle() { return eventForEventSourceId({ eventSourceId: this.id, event: new Created(), eventSource: Ledger, eventStream: 'Postings' }); }
}
@eventSourceDefinition(Account, 'Transactions') @command()
export class PostRaw {
    @field(String) @key() id = '';
    handle() { return eventForEventSourceId({ eventSourceId: this.id, event: new Created(), eventStreamType: 'raw-stream' }); }
}
@eventSourceDefinition(Account, 'Transactions') @command()
export class DepositAndPost {
    @field(String) @key() id = '';
    handle() { return [new Created(), eventForEventSourceId({ eventSourceId: this.id, event: new Created(), eventSource: Ledger, eventStream: 'Postings' })]; }
}
@eventSourceType('orders') @eventStreamType('active') @command()
export class PlaceLegacy { @field(String) @key() id = ''; handle(): Created { return new Created(); } }
@eventSourceDefinition(Account, 'Transactions') @eventStreamId('2026-05', { concurrency: true }) @command()
export class DepositWithFlags { @field(String) @key() id = ''; handle(): Created { return new Created(); } }
@eventSourceDefinition(Account, 'Transactions') @eventSourceType('orders') @command()
export class DepositContradictingLegacy { @field(String) @key() id = ''; handle(): Created { return new Created(); } }
@eventSourceDefinition(Account, 'Transactions') @eventSourceType('Account') @eventStreamType('Transactions') @command()
export class DepositRepeatingLegacy { @field(String) @key() id = ''; handle(): Created { return new Created(); } }
@eventSourceDefinition(Account, 'Missing') @command()
export class DepositToMissingStream { @field(String) @key() id = ''; handle(): Created { return new Created(); } }
@eventSourceDefinition(NotADefinition) @command()
export class DepositToNothing { @field(String) @key() id = ''; handle(): Created { return new Created(); } }
@eventSourceDefinition('Nowhere') @command()
export class DepositToUnknownName { @field(String) @key() id = ''; handle(): Created { return new Created(); } }

@eventSourceDefinition(Account, 'Transactions')
export class Wallet extends AggregateRoot {
    constructor() { super(); this.on(Created, () => {}); }
}
@command()
export class Credit {
    @field(String) @key() id = '';
    @inject(commandAggregate(Wallet))
    handle(wallet: Wallet) { wallet.apply(new Created()); return wallet.commit(); }
}
@eventSourceDefinition(Ledger) @command()
export class CreditOtherLedger {
    @field(String) @key() id = '';
    @inject(commandAggregate(Wallet))
    handle(wallet: Wallet) { wallet.apply(new Created()); return wallet.commit(); }
}

const definitions = [Account, Ledger].map(type => ({ type, name: getEventSourceMetadata(type)!.name,
    streams: getEventStreamsFor(type).map(stream => ({ name: stream.name })) }));

/** A fake event store that knows event source definitions; `legacy` mimics a store built from an older SDK. */
export class an_event_source_aware_store {
    readonly appendMany = sinon.stub().callsFake(async (entries: EventForEventSourceId[]): Promise<AppendResult[]> => entries.map(() => accepted()));
    readonly getTailSequenceNumber = sinon.stub().resolves(new EventSequenceNumber(5n));
    readonly getForEventSourceIdAndEventTypes = sinon.stub().resolves([]);
    legacy = false;
    #store?: IEventStore;
    readonly getEventStore = sinon.stub().callsFake(async (): Promise<IEventStore> => this.#store ??= ({
        eventTypes: { all: [Created] },
        eventLog: { appendMany: this.appendMany, getTailSequenceNumber: this.getTailSequenceNumber,
            getForEventSourceIdAndEventTypes: this.getForEventSourceIdAndEventTypes },
        ...this.legacy ? {} : { eventSources: { getFor: (selector: unknown) => {
            const found = definitions.find(definition => definition.type === selector || definition.name === selector);
            if (!found) throw new Error(`Unknown event source ${String(selector)}`);
            return found;
        } } }
    }) as unknown as IEventStore);
    /** Build an application over the fake store with the given artifacts. */
    build(...artifacts: (new () => object)[]) {
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Accounts', client: { getEventStore: this.getEventStore } as unknown as IChronicleClient });
        builder.add(Created, ...artifacts as never[]);
        return builder.build();
    }
    /** The entries of the first append. */
    get appended(): EventForEventSourceId[] { return this.appendMany.firstCall.args[0] as EventForEventSourceId[]; }
}
