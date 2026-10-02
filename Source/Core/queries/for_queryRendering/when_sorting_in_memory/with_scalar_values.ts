// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, DateOnly, Guid, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { renderQueryData } from '../../queryRendering.js';
import { SortDirection } from '../../SortDirection.js';
import type { QueryResult } from '../../QueryResult.js';
import { Severity } from '../../../validation/Severity.js';

class ScalarConcept extends ConceptAs<unknown> {}
const cases = [
    { kind: 'string', values: ['b', 'a'], order: [1, 0] },
    { kind: 'number', values: [10, 2], order: [1, 0] },
    { kind: 'boolean', values: [true, false], order: [1, 0] },
    { kind: 'date', values: [new Date('2026-01-02T00:00:00Z'), new Date('2026-01-01T00:00:00Z')], order: [1, 0] },
    { kind: 'guid', values: [Guid.parse('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), Guid.parse('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')], order: [1, 0] },
    { kind: 'date only', values: ['2026-02-01', '2026-01-02', '2025-12-31', '2026-01-01'].map(DateOnly.parse), order: [2, 3, 1, 0] },
    { kind: 'time only', values: ['12:00:00', '08:01:00', '08:00:01', '08:00:00.001', '08:00:00'].map(TimeOnly.parse), order: [4, 3, 2, 1, 0] },
    { kind: 'time span', values: ['10.00:00:00', '2.00:00:00', '12:00:00', '00:00:00.0000001', '00:00:00', '-01:00:00', '-02:00:00'].map(TimeSpan.parse), order: [6, 5, 4, 3, 2, 1, 0] },
    { kind: 'null and undefined', values: [2, null, undefined, 1], order: [1, 2, 3, 0], descendingOrder: [0, 3, 1, 2] },
    { kind: 'nullable concept', values: [new ScalarConcept(2), new ScalarConcept(null), new ScalarConcept(1)], order: [1, 2, 0] },
    { kind: 'mixed scalar kinds', values: [2, '10', 1], order: [2, 1, 0] },
    { kind: 'existing bigint comparison', values: [10n, 2n], order: [1, 0] }
];
const concepts = cases.filter(item => !['null and undefined', 'mixed scalar kinds', 'existing bigint comparison'].includes(item.kind))
    .map(item => ({ ...item, kind: `concept over ${item.kind}`, values: item.values.map(value => new ScalarConcept(value)) }));
const nestedConcepts = cases.filter(item => ['number', 'date'].includes(item.kind))
    .map(item => ({ ...item, kind: `nested concept over ${item.kind}`, values: item.values.map(value => new ScalarConcept(new ScalarConcept(value))) }));
const directions = [SortDirection.Ascending, SortDirection.Descending];

describe.each([...cases, ...concepts, ...nestedConcepts].flatMap(item => directions.map(direction => ({ ...item, direction }))))(
    'when sorting in memory with $kind values in $direction order', ({ values, order, descendingOrder, direction }) => {
    let result: QueryResult;
    beforeEach(() => {
        result = renderQueryData({}, values.map((value, index) => ({ value, index })), {
            tenantId: 'test', correlationId: 'test', principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning
        }, { sorting: { field: 'value', direction } });
    });
    it('should accept the scalar values', () => {
        result.isSuccess.should.equal(true);
    });
    it('should preserve the scalar comparison order', () => {
        const expected = direction === SortDirection.Ascending ? order : descendingOrder ?? [...order].reverse();
        (result.data as { index: number }[]).map(item => item.index).should.deep.equal(expected);
    });
});
