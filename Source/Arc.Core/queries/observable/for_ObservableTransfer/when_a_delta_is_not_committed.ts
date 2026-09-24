// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ObservableTransfer } from '../ObservableTransfer.js';
import { result } from './given/a_transfer_result.js';

should();

describe('when a delta is not committed', () => {
    let delivered: ReturnType<ObservableTransfer['prepare']>;
    let retry: typeof delivered;

    beforeEach(() => {
        const transfer = new ObservableTransfer('delta');
        transfer.prepare(result([{ id: '1', name: 'old' }])).commit();
        transfer.prepare(result([{ id: '1', name: 'suppressed' }]));
        delivered = transfer.prepare(result([{ id: '1', name: 'new' }]));
        delivered.commit();
        transfer.prepare(result([{ id: '2', name: 'failed write' }]));
        retry = transfer.prepare(result([{ id: '1', name: 'new' }, { id: '3', name: 'later' }]));
    });

    it('should compare from the last delivered value after suppression', () => {
        delivered.payload.changeSet?.replaced.should.deep.equal([{ id: '1', name: 'new' }]);
    });
    it('should compare from the last delivered value after a failed write', () => {
        retry.payload.changeSet?.added.should.deep.equal([{ id: '3', name: 'later' }]);
        retry.payload.changeSet?.removed.should.deep.equal([]);
    });
});
