// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BehaviorSubject, Subject } from 'rxjs';
import { toEmissions } from '../toEmissions.js';

describe('when consuming RxJS sources', () => {
    it('should replay the current BehaviorSubject value then deliver updates', async () => {
        const source = new BehaviorSubject(1);
        const iterator = toEmissions(source, new AbortController().signal);
        (await iterator.next()).value!.should.equal(1);
        source.next(2);
        (await iterator.next()).value!.should.equal(2);
        await iterator.return(undefined);
        source.observed.should.equal(false);
    });

    it('should complete without inventing a first value', async () => {
        const source = new Subject<number>();
        const iterator = toEmissions(source, new AbortController().signal);
        const pending = iterator.next();
        source.complete();
        (await pending).done!.should.equal(true);
    });

    it('should preserve a source error even when RxJS reports undefined', async () => {
        const source = new Subject<number>();
        const iterator = toEmissions(source, new AbortController().signal);
        const pending = iterator.next();
        source.error(undefined);
        let rejected = false;
        try { await pending; } catch { rejected = true; }
        rejected.should.equal(true);
    });

    it('should release the source on disconnect', async () => {
        const source = new Subject<number>();
        const controller = new AbortController();
        const iterator = toEmissions(source, controller.signal);
        const pending = iterator.next();
        controller.abort();
        (await pending).done!.should.equal(true);
        source.observed.should.equal(false);
    });
});
