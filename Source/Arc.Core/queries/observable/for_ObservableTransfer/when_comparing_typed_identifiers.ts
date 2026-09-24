// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ObservableTransfer } from '../ObservableTransfer.js';
import { result } from './given/a_transfer_result.js';

should();

describe('when comparing case-sensitive and typed identifiers', () => {
    let next: ReturnType<ObservableTransfer['prepare']>;

    beforeEach(() => {
        const transfer = new ObservableTransfer('legacy');
        transfer.prepare(result([{ id: 'A' }, { id: 1 }])).commit();
        next = transfer.prepare(result([{ ID: 'a' }, { ID: '1' }]));
    });

    it('should add distinct identifiers', () => { next.payload.changeSet?.added.should.deep.equal([{ ID: 'a' }, { ID: '1' }]); });
    it('should remove the old identifiers', () => { next.payload.changeSet?.removed.should.deep.equal([{ id: 'A' }, { id: 1 }]); });
    it('should not replace distinct identifiers', () => { next.payload.changeSet?.replaced.should.deep.equal([]); });
});
