// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { renderOpenApi } from '../../renderOpenApi.js';
import type { Operation } from '../../../http/Operation.js';

describe('when documenting command validation with a Validate named command', () => {
    let paths: Record<string, { post: { operationId: string } }>;
    beforeEach(() => {
        const command = { kind: 'command', name: 'Validate', fullyQualifiedName: 'Tasks.Validate', route: '/api/validate',
            schema: z.object({}), inputSchema: { type: 'object', properties: {} },
            run: async () => { throw new Error('not called'); } } as Operation;
        paths = renderOpenApi([command], []).paths as typeof paths;
    });
    it('should document execution at the command route', () => {
        paths['/api/validate']!.post.operationId.should.equal('Tasks.Validate');
    });
    it('should document preflight at the nested validation route', () => {
        paths['/api/validate/validate']!.post.operationId.should.equal('Tasks.Validate:validate');
    });
});
