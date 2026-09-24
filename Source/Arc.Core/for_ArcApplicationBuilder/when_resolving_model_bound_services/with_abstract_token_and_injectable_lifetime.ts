// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, inject, injectable, singleton } from '../../index.js';
import { given } from '../../given.js';
import { an_application_builder } from '../given/an_application_builder.js';

abstract class Repository { abstract get(): string; }
class MemoryRepository extends Repository { get(): string { return 'resolved'; } }

@singleton()
@injectable(Repository)
class Inventory {
    constructor(readonly repository: Repository) {}
}

@command()
class ReadInventory {
    @inject(Inventory)
    handle(inventory: Inventory): string { return inventory.repository.get(); }
}

describe('when resolving a discovered singleton with an injectable abstract token', given(an_application_builder, context => {
    let result: Response;
    beforeEach(async () => {
        const builder = context.create();
        builder.services.addSingleton(Repository, MemoryRepository);
        builder.add(Inventory, ReadInventory);
        const application = await builder.build();
        try {
            result = (await application.server.handle(new Request('http://localhost/api/read-inventory', {
                method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
            })))!;
        } finally { await application.dispose(); }
    });
    it('should resolve the abstract registration through its constructor', async () => {
        (await result.json()).response.should.equal('resolved');
    });
}));
