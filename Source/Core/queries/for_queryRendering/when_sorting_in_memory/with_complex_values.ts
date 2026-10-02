// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs } from '@cratis/fundamentals';
import { describe } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../../ArcServer.js';
import { defineQuery } from '../../defineQuery.js';
import { CurrentValueSubject } from '../../observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../observable/defineObservableQuery.js';
import type { QueryResult } from '../../QueryResult.js';

class Detail { constructor(readonly name: string) {} }
class ComplexConcept extends ConceptAs<object> {}
const values = [
    { kind: 'object', value: (name: string) => ({ name }) },
    { kind: 'array', value: (name: string) => [name] },
    { kind: 'map', value: (name: string) => new Map([['name', name]]) },
    { kind: 'class', value: (name: string) => new Detail(name) },
    { kind: 'concept', value: (name: string) => new ComplexConcept({ name }) }
];

describe.each(values)('when sorting an in-memory array with a $kind value', ({ value }) => {
    let responses: { status: number; result: QueryResult }[];
    beforeEach(async () => {
        const rows = ['bravo', 'alpha', 'charlie'].map(name => ({ name, detail: value(name) }));
        const server = new ArcServer({
            queries: [defineQuery({ name: 'All', schema: z.object({}), perform: () => rows }),
                defineQuery({ name: 'Single', schema: z.object({}), perform: () => rows.slice(0, 1) })],
            observableQueries: [defineObservableQuery({ name: 'Watch', schema: z.object({}), observe: () => CurrentValueSubject.of(rows) })]
        });
        try {
            responses = [];
            for (const path of ['all?sortBy=detail', 'all?sortBy=detail&pageSize=1', 'watch?sortBy=detail', 'single?sortBy=detail', 'all?sortBy=missing']) {
                const response = (await server.handle(new Request(`http://localhost/api/${path}`)))!;
                responses.push({ status: response.status, result: await response.json() as QueryResult });
            }
        } finally { await server.dispose(); }
    });
    it('should reject snapshot, paged array, and observable snapshot sorting like an unknown field', () => {
        for (const response of responses) {
            response.status.should.equal(400);
            response.result.isSuccess.should.equal(false);
            response.result.hasExceptions.should.equal(false);
            response.result.validationResults.should.deep.equal([{ severity: 3, message: 'Malformed request', members: [], reason: 'malformedRequest' }]);
        }
    });
});
