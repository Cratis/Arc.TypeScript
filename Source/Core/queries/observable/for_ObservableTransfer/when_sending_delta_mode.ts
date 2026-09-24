// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ObservableTransfer } from '../ObservableTransfer.js';
import { result } from './given/a_transfer_result.js';

should();

describe('when sending delta mode', () => {
    let first: ReturnType<ObservableTransfer['prepare']>;
    let second: typeof first;

    beforeEach(() => {
        const transfer = new ObservableTransfer('delta');
        first = transfer.prepare(result([{ ID: 'first', name: 'old' }, { id: 'removed', name: 'gone' }]));
        first.commit();
        second = transfer.prepare(result([{ id: 'first', name: 'new' }, { Id: 'added', name: 'fresh' }]));
    });

    it('should send a full first snapshot', () => { should().equal(first.payload.changeSet, undefined); });
    it('should omit data from the later delta', () => { should().equal(second.payload.data, undefined); });
    it('should include added values', () => { second.payload.changeSet?.added.should.deep.equal([{ Id: 'added', name: 'fresh' }]); });
    it('should include replaced values', () => { second.payload.changeSet?.replaced.should.deep.equal([{ id: 'first', name: 'new' }]); });
    it('should include removed values', () => { second.payload.changeSet?.removed.should.deep.equal([{ id: 'removed', name: 'gone' }]); });
});
