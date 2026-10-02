// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { loadConfiguration } from '../loadConfiguration.js';
import type { CratisConfiguration } from '../loadConfiguration.js';

describe('when binding introspection settings using .NET configuration paths', () => {
    let settings: CratisConfiguration;
    beforeEach(() => {
        settings = loadConfiguration('/nonexistent/appsettings.json', {
            Cratis__Arc__Introspection__RequireAuthentication: 'true',
            Cratis__Arc__Introspection__Roles: 'Admin, Operator'
        });
    });
    it('should bind the authentication override and comma-separated roles', () => settings.Cratis!.Arc!.introspection!.should.deep.equal({ requireAuthentication: true, roles: 'Admin, Operator' }));
});
