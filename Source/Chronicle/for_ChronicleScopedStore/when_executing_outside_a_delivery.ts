// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandResult } from '@cratis/arc.core';
import { given } from '../given.js';
import { a_delivery_store, Order } from './given/a_delivery_store.js';

describe('when executing outside a delivery', given(a_delivery_store, context => {
    let result: CommandResult;
    beforeEach(async () => {
        await context.build();
        context.runtimeStore.resolves(context.store);
        result = await context.application.server.executeCommand('ShipOrder', { id: 'order-1' }, context.context());
    });
    afterEach(() => context.dispose());

    it('should succeed', () => { result.isSuccess.should.equal(true); });
    it('should use the runtime client for the tenant', () => { context.runtimeStore.calledWith(context.eventStore, context.tenant).should.equal(true); });
    it('should resolve the command read model', () => { context.find.calledWith(Order, 'order-1').should.equal(true); });
    it('should append', () => { context.appendMany.calledOnce.should.equal(true); });
}));
