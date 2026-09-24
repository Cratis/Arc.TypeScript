// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { renderOpenApi } from '../../renderOpenApi.js';
import { an_operation_set } from '../given/an_operation_set.js';
import type { Operation } from '../../../http/Operation.js';

describe('when documenting query options', given(an_operation_set, context => {
    const parameters = (operation: Operation): { name: string; schema: Record<string, unknown> }[] => {
        const document = renderOpenApi([], [operation]);
        return (document.paths as Record<string, { get: { parameters: { name: string; schema: Record<string, unknown> }[] } }>)[operation.route]!.get.parameters;
    };
    it('should omit paging and sorting for one result', () => {
        const query = { ...context.query, generatedReturn: { cardinality: 'one', element: Number, nullable: false } } as Operation;
        parameters(query).map(item => item.name).should.deep.equal(['filter']);
    });
    it('should retain caller arguments without duplicating reserved names', () => {
        const query = { ...context.query, inputSchema: { properties: { page: { type: 'string' }, sortBy: { type: 'string' } } } } as Operation;
        parameters(query).map(item => item.name).should.deep.equal(['page', 'sortBy', 'pageSize', 'sortDirection']);
    });
    it('should describe fractional first-result timeout for an observable query', () => {
        const query = { ...context.query, observable: true } as Operation;
        const timeout = parameters(query).find(item => item.name === 'waitForFirstResultTimeout');
        timeout?.schema.should.deep.equal({ type: 'number', exclusiveMinimum: 0, maximum: 120 });
    });
}));
