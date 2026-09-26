// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { renderOpenApi } from '../../renderOpenApi.js';
import { an_operation_set } from '../given/an_operation_set.js';

describe('when documenting anonymous operations with a native principal', given(an_operation_set, context => {
    let paths: Record<string, Record<string, { responses: Record<string, unknown> }>>;
    beforeEach(() => {
        paths = renderOpenApi([context.command], [context.query], { nativePrincipal: true }).paths as typeof paths;
    });
    it('should omit 401 from the command and validation operations', () => {
        Object.keys(paths['/api/save']!.post!.responses).should.deep.equal(['200', '400', '403', '500']);
        Object.keys(paths['/api/save/validate']!.post!.responses).should.deep.equal(['200', '400', '403', '500']);
    });
    it('should omit 401 from query GET', () => {
        Object.keys(paths['/api/all']!.get!.responses).should.deep.equal(['200', '400', '403', '500']);
    });
}));
