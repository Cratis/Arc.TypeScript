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
    { kind: 'date', values: [new Date(1000), new Date(0)], order: [1, 0] },
    { kind: 'guid', values: [Guid.parse('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'), Guid.parse('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')], order: [1, 0] },
    { kind: 'date only', values: [DateOnly.parse('2026-02-01'), DateOnly.parse('2026-01-01')], order: [1, 0] },
    { kind: 'time only', values: [TimeOnly.parse('12:00:00'), TimeOnly.parse('08:00:00')], order: [1, 0] },
    { kind: 'time span', values: [TimeSpan.parse('12:00:00'), TimeSpan.parse('08:00:00')], order: [1, 0] },
    { kind: 'null and undefined', values: [2, null, undefined, 1], order: [1, 2, 3, 0] },
    { kind: 'mixed scalar kinds', values: [2, '10', 1], order: [2, 1, 0] },
    { kind: 'existing bigint comparison', values: [10n, 2n], order: [1, 0] }
];
const concepts = cases.filter(item => !['null and undefined', 'mixed scalar kinds', 'existing bigint comparison'].includes(item.kind))
    .map(item => ({ kind: `concept over ${item.kind}`, values: item.values.map(value => new ScalarConcept(value)), order: undefined }));

describe.each([...cases, ...concepts])('when sorting in memory with $kind values', ({ values, order }) => {
    let result: QueryResult;
    beforeEach(() => {
        result = renderQueryData({}, values.map((value, index) => ({ value, index })), {
            tenantId: 'test', correlationId: 'test', principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning
        }, { sorting: { field: 'value', direction: SortDirection.Ascending } });
    });
    it('should accept the scalar values', () => {
        result.isSuccess.should.equal(true);
    });
    // Raw concept ordering is tracked separately in https://github.com/Cratis/Arc.TypeScript/issues/176.
    if (order) it('should preserve the scalar comparison order', () => {
        (result.data as { index: number }[]).map(item => item.index).should.deep.equal(order);
    });
});
