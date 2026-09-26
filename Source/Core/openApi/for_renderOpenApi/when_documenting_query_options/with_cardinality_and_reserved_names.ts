// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { renderOpenApi } from '../../renderOpenApi.js';
import { an_operation_set } from '../given/an_operation_set.js';
import type { Operation } from '../../../http/Operation.js';

describe('when documenting query options', given(an_operation_set, context => {
    const parameters = (operation: Operation): { name: string; description?: string; schema: Record<string, unknown> }[] => {
        const document = renderOpenApi([], [operation]);
        return (document.paths as Record<string, { get: { parameters: { name: string; description?: string; schema: Record<string, unknown> }[] } }>)[operation.route]!.get.parameters;
    };
    it('should omit paging and sorting for one result', () => {
        const query = { ...context.query, generatedReturn: { cardinality: 'one', element: Number, nullable: false } } as Operation;
        parameters(query).map(item => item.name).should.deep.equal(['filter']);
    });
    it('should omit paging and sorting when the result type is unknown', () => {
        const query = { ...context.query, generatedReturn: undefined } as Operation;
        parameters(query).map(item => item.name).should.deep.equal(['filter']);
    });
    it('should omit paging and sorting for void results', () => {
        const query = { ...context.query, generatedReturn: { cardinality: 'void', nullable: false } } as Operation;
        parameters(query).map(item => item.name).should.deep.equal(['filter']);
    });
    it('should advertise paging and sorting for declared arrays', () => {
        const query = { ...context.query, generatedReturn: { cardinality: 'many', element: Number, nullable: false } } as Operation;
        parameters(query).map(item => item.name).should.deep.equal(['filter', 'page', 'pageSize', 'sortBy', 'sortDirection']);
    });
    it('should describe paging and sorting in the same terms as the .NET OpenAPI integration', () => {
        const descriptions = parameters(context.query).map(item => [item.name, item.description]);
        descriptions.should.deep.equal([['filter', undefined], ['page', 'Page number to show'],
            ['pageSize', 'Number of items to limit a page to'], ['sortBy', 'Sort by field name'],
            ['sortDirection', 'Sort direction']]);
    });
    it('should retain caller arguments without duplicating reserved names', () => {
        const query = { ...context.query, inputSchema: { properties: { page: { type: 'string' }, sortBy: { type: 'string' } } } } as Operation;
        parameters(query).map(item => item.name).should.deep.equal(['page', 'sortBy', 'pageSize', 'sortDirection']);
    });
    it('should keep observable wait options without declared paging support', () => {
        const query = { ...context.query, observable: true, generatedReturn: undefined } as Operation;
        parameters(query).map(item => item.name).should.deep.equal(['filter', 'waitForFirstResult', 'waitForFirstResultTimeout']);
    });
    it('should describe fractional first-result timeout for an observable query', () => {
        const query = { ...context.query, observable: true } as Operation;
        const timeout = parameters(query).find(item => item.name === 'waitForFirstResultTimeout');
        timeout?.schema.should.deep.equal({ type: 'number', exclusiveMinimum: 0, maximum: 120 });
    });
}));
