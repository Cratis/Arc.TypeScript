// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { a_delivery_store, commandSignals } from './given/a_delivery_store.js';

describe('when the delivery is cancelled before returned commands', given(a_delivery_store, context => {
    let error: unknown;
    beforeEach(async () => {
        await context.build();
        error = undefined;
        try { await context.deliver(() => context.delivery.abort(new Error('delivery cancelled'))); }
        catch (thrown) { error = thrown; }
    });
    afterEach(() => context.dispose());

    it('should fail the delivery with the cancellation', () => { (error as Error).message.should.equal('delivery cancelled'); });
    it('should not run the returned command', () => { commandSignals.should.have.lengthOf(0); });
    it('should not append', () => { context.appendMany.called.should.equal(false); });
}));
