// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../../given.js';
import { loadConfiguration } from '../loadConfiguration.js';

should();
class an_unknown_setting {
    readonly variables = { CRATIS__ARC__UNKNOWN: 'secret', Cratis__Chronicle__Storage__Type: 'MongoDB' };
    readonly warnings: string[] = [];
}

describe('when an unknown environment key is supplied', given(an_unknown_setting, context => {
    beforeEach(() => {
        loadConfiguration('/nonexistent/appsettings.json', context.variables, error => context.warnings.push(String(error)));
    });
    it('should warn about unknown keys without exposing their values', () => {
        context.warnings.join(' ').should.contain('UNKNOWN');
        context.warnings.join(' ').should.contain('Storage');
        context.warnings.join(' ').should.not.contain('secret');
    });
}));
