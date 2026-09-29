// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { a_delivery_store, commandSignals } from './given/a_delivery_store.js';

describe('when returned commands target another namespace', given(a_delivery_store, context => {
    let error: unknown;
    beforeEach(async () => {
        await context.build();
        error = undefined;
        try { await context.deliver(undefined, 'tenant-b'); }
        catch (thrown) { error = thrown; }
    });
    afterEach(() => context.dispose());

    it('should fail closed', () => { (error as Error).message.should.contain('do not match their Chronicle delivery'); });
    it('should not run the returned command', () => { commandSignals.should.have.lengthOf(0); });
    it('should not fall back to the runtime client', () => { context.runtimeStore.called.should.equal(false); });
}));
