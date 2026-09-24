// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { ArcApplication, command, commandContext, inject, key, rejected, validation } from '@cratis/arc.core';
import type { CommandContext } from '@cratis/arc.core';
import { Created, CreateMany, context, a_registered_command } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';

let application: ArcApplication;
@command() class CreateNested {
    @field(String) @key() id = '';
    @inject(commandContext())
    async handle(execution: CommandContext) {
        const inner = await application.server.executeCommand('CreateMany', { id: this.id }, execution);
        if (!inner.isSuccess) return rejected(validation('Inner command failed'));
        return new Created();
    }
}
@command() class RejectAfterNested {
    @field(String) @key() id = '';
    @inject(commandContext())
    async handle(execution: CommandContext) {
        await application.server.executeCommand('CreateMany', { id: this.id }, execution);
        return rejected(validation('Outer command failed'));
    }
}

describe('when returned events from nested commands join one Chronicle append', () => {
    const setup = new a_registered_command();
    beforeEach(async () => {
        setup.appendMany.resetHistory();
        const store = await setup.getEventStore();
        setup.getEventStore.resolves(store);
        const builder = ArcApplication.createBuilder();
        const { getEventStore } = setup;
        builder.addChronicle({ client: { getEventStore } as never, eventStore: 'Tasks' });
        builder.add(CreateNested, RejectAfterNested, CreateMany, Created);
        application = await builder.build();
    });
    afterEach(async () => { await application.dispose(); });
    it('should commit three events in one batch after the outer command succeeds', async () => {
        const result = await application.server.executeCommand('CreateNested', { id: 'source-1' }, context());
        result.isSuccess.should.equal(true, JSON.stringify(result));
        setup.appendMany.calledOnce.should.equal(true);
        setup.appendMany.firstCall.args[0].should.have.lengthOf(3);
    });
    it('should discard the inner batch when the outer command rejects', async () => {
        const result = await application.server.executeCommand('RejectAfterNested', { id: 'source-1' }, context());
        result.isSuccess.should.equal(false);
        setup.appendMany.called.should.equal(false);
    });
});
