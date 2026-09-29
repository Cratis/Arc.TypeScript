// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../given.js';
import { a_delivery_store, commandSignals, Order, OrderShipped } from './given/a_delivery_store.js';

describe('when handling a delivery', given(a_delivery_store, context => {
    beforeEach(async () => {
        await context.build();
        await context.deliver();
    });
    afterEach(() => context.dispose());

    it('should never use the runtime client', () => { context.runtimeStore.called.should.equal(false); });
    it('should read in the handler from the delivered store', () => { context.find.calledWith(Order, 'from-handler').should.equal(true); });
    it('should resolve the command read model from the delivered store', () => { context.find.calledWith(Order, 'order-1').should.equal(true); });
    it('should rehydrate the command aggregate from the delivered store', () => { context.tail.calledWith('order-1').should.equal(true); });
    it('should append the command events to the delivered store', () => {
        context.appendMany.calledOnce.should.equal(true);
        (context.appendMany.firstCall.args[0] as { event: object }[])[0]!.event.should.be.instanceOf(OrderShipped);
    });
    it('should keep the event correlation for the appended events', () => {
        (context.appendMany.firstCall.args[1] as { correlationId: string }).correlationId.should.equal(context.event.correlationId);
    });
    it('should run the returned command with the delivery cancellation', () => {
        context.delivery.abort();
        commandSignals.should.have.lengthOf(1);
        commandSignals[0]!.aborted.should.equal(true);
    });
}));
