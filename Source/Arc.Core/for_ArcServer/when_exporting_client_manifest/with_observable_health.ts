// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { CurrentValueSubject } from '../../queries/observable/CurrentValueSubject.js';
import { defineObservableQuery } from '../../queries/observable/defineObservableQuery.js';
import { exportClientManifest } from '../../index.js';

should();

describe('when exporting the client manifest with observable health', () => {
    let operations: string[];

    beforeEach(async () => {
        const server = new ArcServer({ enableObservableHealth: true, observableQueries: [defineObservableQuery({
            name: 'Numbers', schema: z.object({}), clientOutput: { output: {
                kind: 'array', element: { kind: 'number' }
            } }, observe: () => new CurrentValueSubject([1])
        })] });
        operations = exportClientManifest(server).operations.map(operation => operation.id);
        await server.dispose();
    });

    it('should omit the built-in health query', () => { operations.should.deep.equal(['Numbers']); });
});
