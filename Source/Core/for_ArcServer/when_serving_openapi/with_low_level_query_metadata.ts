// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer, defineQuery, defineObservableQuery, type GeneratedReturn } from '../../index.js';

describe('when serving OpenAPI with low-level query return metadata', () => {
    let paths: Record<string, { get: { parameters: { name: string }[] } }>;
    beforeEach(async () => {
        const generatedReturn: GeneratedReturn = { cardinality: 'many', nullable: false };
        const server = new ArcServer({
            queries: [defineQuery({ name: 'AllTasks', schema: z.object({}), generatedReturn, perform: () => [] as string[] })],
            observableQueries: [defineObservableQuery({ name: 'WatchTasks', schema: z.object({}), generatedReturn,
                observe: async function* () { yield [] as string[]; } })]
        });
        const response = await server.handle(new Request('http://localhost/openapi.json'));
        paths = (await response!.json() as { paths: typeof paths }).paths;
    });
    it('should advertise paging on the declared array query', () => {
        paths['/api/all-tasks']!.get.parameters.map(parameter => parameter.name)
            .should.include.members(['page', 'pageSize', 'sortBy', 'sortDirection']);
    });
    it('should advertise paging on the declared observable array query', () => {
        paths['/api/watch-tasks']!.get.parameters.map(parameter => parameter.name)
            .should.include.members(['page', 'pageSize', 'sortBy', 'sortDirection']);
    });
});
