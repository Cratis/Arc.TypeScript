// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, deferred, Listener, managerFor, table, tick } from '../given/a_manager.js';

describe('when disposing while a listener factory is pending', () => {
    it('should await and report a late close scheduled during another tenant close', async () => {
        const first = new Listener();
        const firstClose = deferred<void>();
        first.close = () => { first.closeCount++; return firstClose.promise; };
        const late = new Listener();
        const lateClose = deferred<void>();
        late.close = () => { late.closeCount++; return lateClose.promise; };
        const factory = deferred<Listener>();
        const manager = managerFor(tenant => tenant === 'first' ? first : factory.promise, 500);
        const existing = manager.acquire('first', database, table, () => {}, () => {});
        await existing.ready;
        const pending = manager.acquire('second', database, table, () => {}, () => {});
        void pending.ready.catch(() => {});
        await tick();
        const disposal = manager[Symbol.asyncDispose]();
        let finished = false;
        void disposal.finally(() => { finished = true; }).catch(() => {});
        await tick();
        factory.resolve(late);
        await tick();
        firstClose.resolve();
        await tick();
        late.closeCount.should.equal(1);
        finished.should.equal(false);
        lateClose.reject(new Error('late close failed'));
        const error = await disposal.then(() => undefined, cause => cause as AggregateError);
        error!.errors.some(cause => (cause as Error).message === 'late close failed').should.equal(true);
    });
});
