// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication } from '@cratis/arc.core';
import { given } from '../../given.js';
import { Account, DepositToUnknownName } from '../../given/event_source_routing.js';

describe('when a command names a definition Arc does not register', given(class {}, () => {
    let failure: Error | undefined;
    beforeEach(async () => {
        const builder = ArcApplication.createBuilder();
        builder.withChronicle({ eventStore: 'Accounts', connectionString: 'chronicle://localhost:1' });
        builder.add(Account, DepositToUnknownName);
        try { await (await builder.build()).dispose(); } catch (error) { failure = error as Error; }
    });
    it('should refuse to build and list the known definitions', () => {
        failure!.message.should.contain("unknown event source definition 'Nowhere'");
        failure!.message.should.contain('Account');
    });
}));
