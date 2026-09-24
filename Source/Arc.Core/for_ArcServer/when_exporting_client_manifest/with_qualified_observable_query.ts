// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer, exportClientManifest } from '../../index.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';

should();

describe('when exporting the client manifest with a qualified observable query', () => {
    let operation: ReturnType<typeof exportClientManifest>['operations'][number];

    beforeEach(async () => {
        const server = new ArcServer({ observableQueries: [defineObservableQuery({
            name: 'Numbers', namespace: 'Samples', schema: z.object({}),
            clientOutput: { output: { kind: 'array', element: { kind: 'number' } } },
            observe: () => new CurrentValueSubject<number[]>()
        })] });
        operation = exportClientManifest(server).operations[0]!;
        await server.dispose();
    });

    it('should export an observable operation', () => { operation.kind.should.equal('observable'); });
    it('should preserve the qualified query name', () => { operation.queryName?.should.equal('Samples.Numbers'); });
});
