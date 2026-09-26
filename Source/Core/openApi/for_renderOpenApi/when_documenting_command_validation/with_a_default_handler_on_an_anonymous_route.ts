// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { renderOpenApi } from '../../renderOpenApi.js';
import { an_operation_set } from '../given/an_operation_set.js';
import { AuthenticationStatus } from '../../../authentication/AuthenticationStatus.js';

const handler = async () => ({ status: AuthenticationStatus.Failed as const });

describe('when documenting anonymous operations with a default authentication handler', given(an_operation_set, context => {
    let paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    beforeEach(() => {
        paths = renderOpenApi([context.command], [context.query], { authentication: [handler] }).paths as typeof paths;
    });
    it('should list 401 for the command and validation operations', () => {
        Object.keys(paths['/api/save']!.post!.responses).should.deep.equal(['200', '400', '401', '403', '500']);
        Object.keys(paths['/api/save/validate']!.post!.responses).should.deep.equal(['200', '400', '401', '403', '500']);
    });
    it('should list 401 for query GET', () => {
        Object.keys(paths['/api/all']!.get!.responses).should.deep.equal(['200', '400', '401', '403', '500']);
    });
}));
