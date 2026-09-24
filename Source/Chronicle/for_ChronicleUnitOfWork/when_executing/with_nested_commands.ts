// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { ArcApplication, command, commandContext, inject, key, rejected, validation } from '@cratis/arc.core';
import type { CommandContext } from '@cratis/arc.core';
import { Created, CreateMany, CreateRejected, context, a_registered_command } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';
import { accepted } from '../../for_ChronicleCommand/given/a_command_with_typed_ports.js';

let application: ArcApplication;
let otherApplication: ArcApplication;
@command() class CreateNested {
    @field(String) @key() id = '';
    @inject(commandContext())
    async handle(execution: CommandContext) {
        const inner = await application.server.executeCommand('CreateMany', { id: this.id }, execution);
        if (!inner.isSuccess) return rejected(validation('Inner command failed'));
        return new Created();
    }
}
@command() class CrossStoreNested {
    @field(String) @key() id = '';
    @inject(commandContext())
    async handle(execution: CommandContext) {
        await otherApplication.server.executeCommand('CreateMany', { id: this.id }, execution);
        return new Created();
    }
}
@command() class CrossTenantNested {
    @field(String) @key() id = '';
    @inject(commandContext())
    async handle(execution: CommandContext) {
        await application.server.executeCommand('CreateMany', { id: this.id }, { ...execution, tenantId: 'other-tenant' });
        return new Created();
    }
}
@command() class IgnoreNestedFailure {
    @field(String) @key() id = '';
    @inject(commandContext())
    async handle(execution: CommandContext) {
        await application.server.executeCommand('CreateRejected', { id: this.id }, execution);
        return new Created();
    }
}
let detached: Promise<unknown>;
@command() class DetachedNested {
    @field(String) @key() id = '';
    @inject(commandContext())
    handle(execution: CommandContext) {
        const id = this.id;
        detached = new Promise(resolve => {
            setImmediate(async () => resolve(await application.server.executeCommand('CreateMany', { id }, execution)));
        });
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
        setup.appendMany.callsFake(async (entries: object[]) => entries.map(() => accepted()));
        const store = await setup.getEventStore();
        setup.getEventStore.resolves(store);
        const builder = ArcApplication.createBuilder();
        const { getEventStore } = setup;
        builder.addChronicle({ client: { getEventStore } as never, eventStore: 'Tasks' });
        builder.add(CreateNested, DetachedNested, CrossTenantNested, CrossStoreNested, RejectAfterNested, IgnoreNestedFailure, CreateMany, CreateRejected, Created);
        application = await builder.build();
        const other = ArcApplication.createBuilder();
        other.addChronicle({ client: { getEventStore: async () => ({ ...store }) } as never, eventStore: 'Other' });
        other.add(CreateMany, Created);
        otherApplication = await other.build();
    });
    afterEach(async () => { await application.dispose(); await otherApplication.dispose(); });
    it('should commit three events in one batch after the outer command succeeds', async () => {
        const result = await application.server.executeCommand('CreateNested', { id: 'source-1' }, context());
        result.isSuccess.should.equal(true, JSON.stringify(result));
        setup.appendMany.calledOnce.should.equal(true);
        setup.appendMany.firstCall.args[0].should.have.lengthOf(3);
    });
    it('should append a detached nested command after its outer unit has completed', async () => {
        const outer = await application.server.executeCommand('DetachedNested', { id: 'source-2' }, context());
        outer.isSuccess.should.equal(true);
        const nested = await detached as { isSuccess: boolean };
        nested.isSuccess.should.equal(true);
        setup.appendMany.calledTwice.should.equal(true);
        setup.appendMany.firstCall.args[0].should.have.lengthOf(1);
        setup.appendMany.secondCall.args[0].should.have.lengthOf(2);
    });
    it('should reject a partial or unknown append acknowledgment', async () => {
        setup.appendMany.resolves([]);
        const result = await application.server.executeCommand('CreateNested', { id: 'source-1' }, context());
        result.isSuccess.should.equal(false);
        result.hasExceptions.should.equal(true);
        (result.response === undefined).should.equal(true);
    });
    it('should refuse a cross-tenant nested command and discard outer events', async () => {
        const result = await application.server.executeCommand('CrossTenantNested', { id: 'source-1' }, context());
        result.isSuccess.should.equal(false);
        setup.appendMany.called.should.equal(false);
    });
    it('should refuse a cross-store nested command and discard outer events', async () => {
        const result = await application.server.executeCommand('CrossStoreNested', { id: 'source-1' }, context());
        result.isSuccess.should.equal(false);
        setup.appendMany.called.should.equal(false);
    });
    it('should discard staged events when a nested command fails even if the outer command ignores it', async () => {
        const result = await application.server.executeCommand('IgnoreNestedFailure', { id: 'source-1' }, context());
        result.isSuccess.should.equal(false);
        setup.appendMany.called.should.equal(false);
    });
    it('should discard the inner batch when the outer command rejects', async () => {
        const result = await application.server.executeCommand('RejectAfterNested', { id: 'source-1' }, context());
        result.isSuccess.should.equal(false);
        setup.appendMany.called.should.equal(false);
    });
});
