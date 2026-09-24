// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ObservableTransfer } from '../ObservableTransfer.js';
import { result } from './given/a_transfer_result.js';

should();

describe('when sending scalar data in delta mode', () => {
    let second: ReturnType<ObservableTransfer['prepare']>;

    beforeEach(() => {
        const transfer = new ObservableTransfer('delta');
        transfer.prepare(result(0)).commit();
        second = transfer.prepare(result(false));
    });

    it('should include the scalar data', () => { should().equal(second.payload.data, false); });
    it('should omit a change set', () => { should().equal(second.payload.changeSet, undefined); });
});
