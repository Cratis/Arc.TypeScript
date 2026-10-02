// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { describe } from 'vitest';
import type { ClientField } from '../../../introspection/ClientField.js';
import type { QueryResult } from '../../QueryResult.js';
import { renderQueryData } from '../../queryRendering.js';
import { SortDirection } from '../../SortDirection.js';
import { Severity } from '../../../validation/Severity.js';

const cases: { kind: string; type: ClientField['type']; values: (string | number)[]; order: number[] }[] = [
    { kind: 'numeric strings', type: { kind: 'string' }, values: ['2', '10'], order: [1, 0] },
    { kind: 'numbers', type: { kind: 'number' }, values: [10, 2], order: [1, 0] },
    { kind: 'date strings', type: { kind: 'string' }, values: ['2026-01-02T00:00:00.000Z', '2026-01-01T00:00:00.000Z'], order: [1, 0] },
    { kind: 'date only strings', type: { kind: 'string' }, values: ['2026-02-01', '2026-01-01'], order: [1, 0] },
    { kind: 'time only strings', type: { kind: 'string' }, values: ['12:00:00', '08:00:00'], order: [1, 0] },
    { kind: 'time span strings', type: { kind: 'string' }, values: ['2.00:00:00', '10.00:00:00'], order: [1, 0] }
];
const directions = [SortDirection.Ascending, SortDirection.Descending];

describe.each(cases.flatMap(item => directions.map(direction => ({ ...item, direction }))))(
    'when sorting in memory with encoded $kind in $direction order', ({ type, values, order, direction }) => {
    let result: QueryResult;
    beforeEach(() => {
        result = renderQueryData({ clientOutput: { output: { kind: 'array', element: { kind: 'dto', name: 'Row', fields: [
            { name: 'value', type }, { name: 'index', type: { kind: 'number' } }
        ] } } } }, values.map((value, index) => ({ value, index })), {
            tenantId: 'test', correlationId: 'test', principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Warning
        }, { sorting: { field: 'value', direction } });
    });
    it('should preserve the wire values and their existing comparison order', () => {
        const expected = direction === SortDirection.Ascending ? order : [...order].reverse();
        result.isSuccess.should.equal(true);
        result.data!.should.deep.equal(expected.map(index => ({ value: values[index], index })));
    });
});
