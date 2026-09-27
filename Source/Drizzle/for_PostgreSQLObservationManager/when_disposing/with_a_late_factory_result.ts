// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { database, deferred, Listener, managerFor, table } from '../given/a_manager.js';

describe('when disposing while a listener factory is pending', () => {
    it('should await and report a late close scheduled during another tenant close', async () => {
        const first = new Listener();
        const firstClose = deferred<void>();
        first.close = () => { first.closeCount++; return firstClose.promise; };
        const late = new Listener();
        const lateClose = deferred<void>();
        const lateCloseStarted = deferred<void>();
        late.close = () => { late.closeCount++; lateCloseStarted.resolve(); return lateClose.promise; };
        const factory = deferred<Listener>();
        const factoryStarted = deferred<void>();
        const manager = managerFor(tenant => {
            if (tenant === 'first') return first;
            factoryStarted.resolve();
            return factory.promise;
        }, 500);
        const existing = manager.acquire('first', database, table, () => {}, () => {});
        await existing.ready;
        const pending = manager.acquire('second', database, table, () => {}, () => {});
        void pending.ready.catch(() => {});
        await factoryStarted.promise;
        const disposal = manager[Symbol.asyncDispose]();
        let finished = false;
        void disposal.finally(() => { finished = true; }).catch(() => {});
        factory.resolve(late);
        firstClose.resolve();
        await lateCloseStarted.promise;
        late.closeCount.should.equal(1);
        finished.should.equal(false);
        lateClose.reject(new Error('late close failed'));
        const error = await disposal.then(() => undefined, cause => cause as AggregateError);
        error!.errors.some(cause => (cause as Error).message === 'late close failed').should.equal(true);
    });
});
