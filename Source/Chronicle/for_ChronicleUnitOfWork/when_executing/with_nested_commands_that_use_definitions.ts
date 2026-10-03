// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { ArcApplication, command, commandContext, inject, key } from '@cratis/arc.core';
import type { CommandContext } from '@cratis/arc.core';
import { context } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';
import { Account, Deposit, Ledger, PostToLedger, an_event_source_aware_store } from '../../given/event_source_routing.js';
import { Created } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';
import { eventSourceDefinition } from '../../index.js';
import { given } from '../../given.js';

let application: ArcApplication;
@eventSourceDefinition(Account, 'Statements') @command()
class Statement {
    @field(String) @key() id = '';
    @inject(commandContext())
    async handle(execution: CommandContext) {
        await application.server.executeCommand('Deposit', { id: this.id }, execution);
        await application.server.executeCommand('PostToLedger', { id: this.id }, execution);
        return new Created();
    }
}

describe('when nested commands select different event source definitions', given(an_event_source_aware_store, setup => {
    it('should append every event once, each routed through its own command definition', async () => {
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Accounts', client: { getEventStore: setup.getEventStore } as never });
        builder.add(Created, Statement, Deposit, PostToLedger);
        application = await builder.build();
        try {
            const result = await application.server.executeCommand('Statement', { id: 'account-1' }, context());
            result.isSuccess.should.equal(true, JSON.stringify(result));
            setup.appendMany.calledOnce.should.equal(true);
            setup.appended.map(entry => [entry.eventSource, entry.eventStream]).should.deep.equal([
                [Account, 'Transactions'], [Ledger, 'Postings'], [Account, 'Statements']]);
        } finally { await application.dispose(); }
    });
}));
