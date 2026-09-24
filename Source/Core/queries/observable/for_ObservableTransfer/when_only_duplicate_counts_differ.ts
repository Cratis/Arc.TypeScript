// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ObservableTransfer } from '../ObservableTransfer.js';
import { result } from './given/a_transfer_result.js';

should();

describe('when only duplicate counts differ', () => {
    let next: ReturnType<ObservableTransfer['prepare']>;

    beforeEach(() => {
        const transfer = new ObservableTransfer('legacy');
        transfer.prepare(result([{ name: 'same' }, { name: 'same' }])).commit();
        next = transfer.prepare(result([{ name: 'same' }]));
    });

    it('should not add values', () => { next.payload.changeSet?.added.should.deep.equal([]); });
    it('should not remove values', () => { next.payload.changeSet?.removed.should.deep.equal([]); });
});
