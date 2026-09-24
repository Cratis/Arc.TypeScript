// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ObservableTransfer } from '../ObservableTransfer.js';
import { result } from './given/a_transfer_result.js';

should();

describe('when sending full mode', () => {
    let first: ReturnType<ObservableTransfer['prepare']>;
    let next: typeof first;

    beforeEach(() => {
        const transfer = new ObservableTransfer('full');
        first = transfer.prepare(result([{ id: '1' }]));
        first.commit();
        next = transfer.prepare(result([{ id: '2' }]));
    });

    it('should omit change sets from the first snapshot', () => { should().equal(first.payload.changeSet, undefined); });
    it('should deliver the next full snapshot', () => {
        JSON.stringify(next.payload.data).should.equal(JSON.stringify([{ id: '2' }]));
    });
    it('should omit change sets from later snapshots', () => { should().equal(next.payload.changeSet, undefined); });
});
