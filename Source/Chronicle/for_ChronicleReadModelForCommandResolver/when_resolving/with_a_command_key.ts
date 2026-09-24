// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { readModel as chronicleModel } from '@cratis/chronicle/readModels';
import { fromEvent } from '@cratis/chronicle/projections';
import { eventType } from '@cratis/chronicle/events';
import type { IChronicleClient, IEventStore } from '@cratis/chronicle';
import { ArcApplication, command, commandReadModel, inject, key, provided, readModel } from '@cratis/arc.core';
import sinon from 'sinon';
import { context } from '../../for_ChronicleResponseHandler/given/a_registered_command.js';
import '../../index.js';

@eventType() class AuthorAdded { @field(String) name = ''; }
@readModel() @chronicleModel() @fromEvent(AuthorAdded)
class Author { @field(String) id = ''; @field(String) name = ''; }
@command() class RenameAuthor {
    @field(String) @key() id = '';
    @inject(commandReadModel(Author))
    handle(author: Author): string { return author.name; }
}
@command() class PrepareRename {
    @field(String) @key() id = '';
    @inject(commandReadModel(Author))
    provide(author: Author): string { return author.name; }
    handle(name: string): string { return name; }
}
@command() class PrepareAndHandle {
    @field(String) @key() id = '';
    @inject(commandReadModel(Author))
    provide(author: Author): Author { return author; }
    @inject(provided(Author), commandReadModel(Author))
    handle(prepared: Author, author: Author): string { return `${prepared.name} ${author.id}`; }
}
@command() class RenameUsingEventSourceId {
    @field(String) @key() id = '';
    @field(String) sourceId = '';
    getEventSourceId() { return this.sourceId; }
    @inject(commandReadModel(Author))
    handle(author: Author): string { return author.name; }
}
@command() class FindOptionalAuthor {
    @field(String) @key() id = '';
    @inject(commandReadModel(Author, { optional: true }))
    handle(author: Author | null): boolean { return author === null; }
}

describe('when resolving a Chronicle read model by the command key', () => {
    const find = sinon.stub();
    const getStore = sinon.stub();
    let application: ArcApplication;
    beforeEach(async () => {
        find.reset();
        getStore.reset();
        find.resolves(Object.assign(new Author(), { id: 'author-1', name: 'Ada' }));
        getStore.callsFake(async (): Promise<IEventStore> => ({ readModels: { findInstanceById: find } }) as unknown as IEventStore);
        const builder = ArcApplication.createBuilder();
        builder.addChronicle({ eventStore: 'Authors', client: { getEventStore: getStore } as unknown as IChronicleClient });
        builder.add(RenameAuthor, RenameUsingEventSourceId, PrepareRename, PrepareAndHandle, FindOptionalAuthor, Author, AuthorAdded);
        application = await builder.build();
    });
    afterEach(async () => { await application.dispose(); });
    it('should resolve a handle parameter in the trusted namespace', async () => {
        const result = await application.server.executeCommand('RenameAuthor', { id: 'author-1' }, context('tenant-a'));
        (result.response as string).should.equal('Ada');
        getStore.calledWith('Authors', 'tenant-a').should.equal(true);
        find.calledWith(Author, 'author-1').should.equal(true);
    });
    it('should resolve a read model using the Chronicle event source id over the key field', async () => {
        const result = await application.server.executeCommand('RenameUsingEventSourceId', { id: 'other', sourceId: 'author-1' }, context());
        result.isSuccess.should.equal(true);
        find.calledWith(Author, 'author-1').should.equal(true);
    });
    it('should resolve a provide parameter', async () => {
        const result = await application.server.executeCommand('PrepareRename', { id: 'author-1' }, context());
        (result.response as string).should.equal('Ada');
    });
    it('should reuse the command-scoped read model across provide and handle', async () => {
        const result = await application.server.executeCommand('PrepareAndHandle', { id: 'author-1' }, context());
        (result.response as string).should.equal('Ada author-1');
        find.calledOnce.should.equal(true);
    });
    it('should reject an absent required read model without running handle', async () => {
        find.resolves(null);
        const result = await application.server.executeCommand('RenameAuthor', { id: 'author-1' }, context());
        result.isSuccess.should.equal(false);
        result.validationResults[0]!.message.should.equal('Author was not found for the command key');
        result.hasExceptions.should.equal(false);
    });
    it('should reject an unresolvable key even for an optional read model', async () => {
        const result = await application.server.executeCommand('FindOptionalAuthor', { id: '' }, context());
        result.isSuccess.should.equal(false);
        result.validationResults[0]!.message.should.equal('A command key is required for Author');
        find.called.should.equal(false);
    });
    it('should pass null for an absent optional read model', async () => {
        find.resolves(null);
        const result = await application.server.executeCommand('FindOptionalAuthor', { id: 'author-1' }, context());
        (result.response as boolean).should.equal(true);
    });
});
