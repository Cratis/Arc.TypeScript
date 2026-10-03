// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { ConcurrencyDimensions, eventSource, eventStream } from '@cratis/chronicle';
import { eventType } from '@cratis/chronicle/events';
import { command, inject, key } from '@cratis/arc.core';
import { AggregateRoot } from '../AggregateRoot.js';
import { commandAggregate } from '../commandAggregate.js';
import { eventForEventSourceId } from '../eventForEventSourceId.js';
import { eventSourceDefinition } from '../eventSourceDefinition.js';

@eventType('ArcTypeScriptRoutedFundsDeposited')
export class RoutedFundsDeposited { @field(String) note: string; constructor(note = '') { this.note = note; } }

@eventSource({ name: 'ArcTypeScriptRoutedAccount' })
@eventStream('Transactions', { concurrency: ConcurrencyDimensions.eventStreamType | ConcurrencyDimensions.eventStreamId })
export class RoutedAccount {}

@eventSource({ name: 'ArcTypeScriptRoutedLedger' })
@eventStream('Postings', { concurrency: ConcurrencyDimensions.eventStreamType })
export class RoutedLedger {}

@eventSourceDefinition(RoutedAccount, 'Transactions') @command()
export class DepositRouted {
    @field(String) @key() id = '';
    handle(): RoutedFundsDeposited { return new RoutedFundsDeposited('command'); }
}

@eventSourceDefinition(RoutedAccount, 'Transactions') @command()
export class DepositAndPostRouted {
    @field(String) @key() id = '';
    handle() {
        return [new RoutedFundsDeposited('account'), eventForEventSourceId({ eventSourceId: this.id,
            event: new RoutedFundsDeposited('ledger'), eventSource: RoutedLedger, eventStream: 'Postings' })];
    }
}

@eventSourceDefinition(RoutedAccount, 'Transactions') @command()
export class DepositAndPostElsewhere {
    @field(String) @key() id = '';
    handle() {
        return [new RoutedFundsDeposited('account'), eventForEventSourceId({ eventSourceId: `${this.id}-ledger`,
            event: new RoutedFundsDeposited('ledger'), eventSource: RoutedLedger, eventStream: 'Postings' })];
    }
}

@eventSourceDefinition(RoutedAccount, 'Transactions')
export class RoutedWallet extends AggregateRoot {
    count = 0;
    constructor() { super(); this.on(RoutedFundsDeposited, () => { this.count++; }); }
}

@command()
export class CreditRoutedWallet {
    @field(String) @key() id = '';
    @inject(commandAggregate(RoutedWallet))
    handle(wallet: RoutedWallet) { wallet.apply(new RoutedFundsDeposited(`seen-${wallet.count}`)); return wallet.commit(); }
}
