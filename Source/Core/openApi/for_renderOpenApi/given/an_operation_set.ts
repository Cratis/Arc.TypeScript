// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import type { Operation } from '../../../http/Operation.js';

export class an_operation_set {
    readonly command = { kind: 'command', name: 'Save', namespace: 'Tasks', fullyQualifiedName: 'Tasks.Save', route: '/api/save',
        inputSchema: { type: 'object', properties: { id: { type: 'string' } } }, schema: z.object({ id: z.string() }),
        generatedReturn: { cardinality: 'one', element: String, nullable: false },
        run: async () => { throw new Error('not called'); } } as Operation;
    readonly query = { kind: 'query', name: 'All', namespace: 'Tasks', fullyQualifiedName: 'Tasks.All', route: '/api/all',
        inputSchema: { type: 'object', properties: { filter: { type: 'string' } } }, schema: z.object({ filter: z.string() }),
        generatedReturn: { cardinality: 'paged', element: Number, nullable: false },
        run: async () => { throw new Error('not called'); } } as Operation;
}
