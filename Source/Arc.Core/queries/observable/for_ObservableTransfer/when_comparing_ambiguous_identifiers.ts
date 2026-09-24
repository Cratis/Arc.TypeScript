// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ObservableTransfer } from '../ObservableTransfer.js';
import { result } from './given/a_transfer_result.js';

should();

describe('when comparing missing or ambiguous identifiers', () => {
    let next: ReturnType<ObservableTransfer['prepare']>;
    let duplicate: typeof next;

    beforeEach(() => {
        const transfer = new ObservableTransfer('legacy');
        transfer.prepare(result([{ name: 'same' }, { name: 'removed' }])).commit();
        next = transfer.prepare(result([{ name: 'same' }, { name: 'added' }]));
        const withDuplicates = new ObservableTransfer('legacy');
        withDuplicates.prepare(result([{ id: 'x', value: 1 }, { id: 'x', value: 2 }])).commit();
        duplicate = withDuplicates.prepare(result([{ id: 'x', value: 2 }]));
    });

    it('should add unmatched JSON values', () => { next.payload.changeSet?.added.should.deep.equal([{ name: 'added' }]); });
    it('should remove unmatched JSON values', () => { next.payload.changeSet?.removed.should.deep.equal([{ name: 'removed' }]); });
    it('should not replace matching JSON values', () => { next.payload.changeSet?.replaced.should.deep.equal([]); });
    it('should remove a duplicated identifier with a different value', () => {
        duplicate.payload.changeSet?.removed.should.deep.equal([{ id: 'x', value: 1 }]);
    });
});
