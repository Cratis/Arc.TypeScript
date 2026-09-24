// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe, it, should } from 'vitest';
import { Severity, queryResult } from '../../index.js';
import type { ExecutionContext } from '../../index.js';
import { ObservableTransfer } from '../../queries/observable/ObservableTransfer.js';

should();
const context: ExecutionContext = {
    correlationId: crypto.randomUUID(), signal: new AbortController().signal,
    allowedSeverity: Severity.Warning, principal: undefined, tenantId: undefined
};
const result = (data: unknown) => queryResult(context, { data });

describe('observable transfer modes', () => {
    it('should send only full snapshots in full mode', () => {
        const transfer = new ObservableTransfer('full');
        const first = transfer.prepare(result([{ id: '1' }]));
        should().equal(first.payload.changeSet, undefined);
        first.commit();
        const next = transfer.prepare(result([{ id: '2' }]));
        JSON.stringify(next.payload.data).should.equal(JSON.stringify([{ id: '2' }]));
        should().equal(next.payload.changeSet, undefined);
    });

    it('should send a full first delta and later changes without data', () => {
        const transfer = new ObservableTransfer('delta');
        const first = transfer.prepare(result([{ ID: 'first', name: 'old' }, { id: 'removed', name: 'gone' }]));
        should().equal(first.payload.changeSet, undefined);
        first.commit();
        const second = transfer.prepare(result([{ id: 'first', name: 'new' }, { Id: 'added', name: 'fresh' }]));
        should().equal(second.payload.data, undefined);
        second.payload.changeSet?.added.should.deep.equal([{ Id: 'added', name: 'fresh' }]);
        second.payload.changeSet?.replaced.should.deep.equal([{ id: 'first', name: 'new' }]);
        second.payload.changeSet?.removed.should.deep.equal([{ id: 'removed', name: 'gone' }]);
    });

    it('should compute from the last delivered result when a frame is suppressed or a write fails', () => {
        const transfer = new ObservableTransfer('delta');
        const first = transfer.prepare(result([{ id: '1', name: 'old' }]));
        first.commit();
        transfer.prepare(result([{ id: '1', name: 'suppressed' }]));
        const delivered = transfer.prepare(result([{ id: '1', name: 'new' }]));
        delivered.payload.changeSet?.replaced.should.deep.equal([{ id: '1', name: 'new' }]);
        delivered.commit();
        transfer.prepare(result([{ id: '2', name: 'failed write' }]));
        const retry = transfer.prepare(result([{ id: '1', name: 'new' }, { id: '3', name: 'later' }]));
        retry.payload.changeSet?.added.should.deep.equal([{ id: '3', name: 'later' }]);
        retry.payload.changeSet?.removed.should.deep.equal([]);
    });

    it('should send data and change sets in absent and unknown legacy modes', () => {
        for (const preference of [undefined, 'unknown']) {
            const transfer = new ObservableTransfer(preference);
            const first = transfer.prepare(result([{ id: 1 }]));
            first.payload.changeSet?.added.should.deep.equal([{ id: 1 }]);
            JSON.stringify(first.payload.data).should.equal(JSON.stringify([{ id: 1 }]));
            first.commit();
            const next = transfer.prepare(result([{ id: 2 }]));
            next.payload.changeSet?.removed.should.deep.equal([{ id: 1 }]);
            next.payload.changeSet?.added.should.deep.equal([{ id: 2 }]);
        }
    });

    it('should use JSON comparison for missing or ambiguous identities', () => {
        const transfer = new ObservableTransfer('legacy');
        transfer.prepare(result([{ name: 'same' }, { name: 'removed' }])).commit();
        const next = transfer.prepare(result([{ name: 'same' }, { name: 'added' }]));
        next.payload.changeSet?.added.should.deep.equal([{ name: 'added' }]);
        next.payload.changeSet?.removed.should.deep.equal([{ name: 'removed' }]);
        next.payload.changeSet?.replaced.should.deep.equal([]);
        const duplicate = new ObservableTransfer('legacy');
        duplicate.prepare(result([{ id: 'x', value: 1 }, { id: 'x', value: 2 }])).commit();
        duplicate.prepare(result([{ id: 'x', value: 2 }])).payload.changeSet?.removed.should.deep.equal([{ id: 'x', value: 1 }]);
    });

    it('should compare identity values by case and JSON primitive type', () => {
        const transfer = new ObservableTransfer('legacy');
        transfer.prepare(result([{ id: 'A' }, { id: 1 }])).commit();
        const next = transfer.prepare(result([{ ID: 'a' }, { ID: '1' }]));
        next.payload.changeSet?.added.should.deep.equal([{ ID: 'a' }, { ID: '1' }]);
        next.payload.changeSet?.removed.should.deep.equal([{ id: 'A' }, { id: 1 }]);
        next.payload.changeSet?.replaced.should.deep.equal([]);
    });

    it('should use JSON set comparison when only duplicate counts differ', () => {
        const transfer = new ObservableTransfer('legacy');
        transfer.prepare(result([{ name: 'same' }, { name: 'same' }])).commit();
        const next = transfer.prepare(result([{ name: 'same' }]));
        next.payload.changeSet?.added.should.deep.equal([]);
        next.payload.changeSet?.removed.should.deep.equal([]);
    });

    it('should never omit scalar data, even in delta mode', () => {
        const transfer = new ObservableTransfer('delta');
        transfer.prepare(result(0)).commit();
        const second = transfer.prepare(result(false));
        should().equal(second.payload.data, false);
        should().equal(second.payload.changeSet, undefined);
    });
});
