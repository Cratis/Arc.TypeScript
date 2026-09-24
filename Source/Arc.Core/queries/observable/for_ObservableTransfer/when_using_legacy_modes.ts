// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ObservableTransfer } from '../ObservableTransfer.js';
import { result } from './given/a_transfer_result.js';

should();

describe('when using absent or unknown legacy transfer modes', () => {
    let snapshots: ReturnType<ObservableTransfer['prepare']>[];
    let changes: ReturnType<ObservableTransfer['prepare']>[];

    beforeEach(() => {
        snapshots = [];
        changes = [];
        for (const preference of [undefined, 'unknown']) {
            const transfer = new ObservableTransfer(preference);
            const first = transfer.prepare(result([{ id: 1 }]));
            snapshots.push(first);
            first.commit();
            changes.push(transfer.prepare(result([{ id: 2 }])));
        }
    });

    it('should include the first snapshot data and change set', () => {
        for (const first of snapshots) {
            first.payload.changeSet?.added.should.deep.equal([{ id: 1 }]);
            JSON.stringify(first.payload.data).should.equal(JSON.stringify([{ id: 1 }]));
        }
    });
    it('should include later removals and additions', () => {
        for (const next of changes) {
            next.payload.changeSet?.removed.should.deep.equal([{ id: 1 }]);
            next.payload.changeSet?.added.should.deep.equal([{ id: 2 }]);
        }
    });
});
