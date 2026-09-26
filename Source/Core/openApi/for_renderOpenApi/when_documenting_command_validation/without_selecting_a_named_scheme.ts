// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { renderOpenApi } from '../../renderOpenApi.js';
import { an_operation_set } from '../given/an_operation_set.js';
import type { Operation } from '../../../http/Operation.js';
import { AuthenticationStatus } from '../../../authentication/AuthenticationStatus.js';

const handler = async () => ({ status: AuthenticationStatus.Anonymous as const });

describe('when documenting operations without selecting a named-only scheme', given(an_operation_set, context => {
    let paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    beforeEach(() => {
        const authorization = { authenticated: true };
        const command = { ...context.command, authorization } as Operation;
        const query = { ...context.query, authorization } as Operation;
        paths = renderOpenApi([command], [query], { authenticationSchemes: { Verified: handler } }).paths as typeof paths;
    });
    it('should omit 401 from both command operations', () => {
        Object.keys(paths['/api/save']!.post!.responses).should.deep.equal(['200', '400', '403', '500']);
        Object.keys(paths['/api/save/validate']!.post!.responses).should.deep.equal(['200', '400', '403', '500']);
    });
    it('should omit 401 from query GET', () => {
        Object.keys(paths['/api/all']!.get!.responses).should.deep.equal(['200', '400', '403', '500']);
    });
}));
