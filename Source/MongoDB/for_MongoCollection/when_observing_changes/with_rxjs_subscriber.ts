// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import sinon from 'sinon';
import { firstValueFrom, take } from 'rxjs';
import type { ChangeStream, Document } from 'mongodb';
import { MongoObservable } from '../../MongoObservable.js';
import { MongoObservation } from '../../MongoObservation.js';

should();

describe('when observing MongoDB changes with an RxJS subscriber', () => {
    it('should read the initial value and release the cursor on unsubscribe', async () => {
        const close = sinon.stub().resolves();
        const stream = { close } as unknown as ChangeStream<Document>;
        const open = sinon.stub().resolves(new MongoObservation(stream, async () => 2, 1,
            new AbortController().signal, () => {}));
        const source = new MongoObservable<number>(open);
        (await source.current()).value.should.equal(1);
        (await firstValueFrom(source.pipe(take(1)))).should.equal(1);
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        open.calledOnce.should.equal(true);
        close.calledOnce.should.equal(true);
    });

    it('should propagate an opening failure to the subscriber', async () => {
        const source = new MongoObservable<number>(() => Promise.reject(new Error('replica set required')));
        let failure: unknown;
        try { await firstValueFrom(source); } catch (error) { failure = error; }
        String(failure).should.contain('replica set required');
    });
});
