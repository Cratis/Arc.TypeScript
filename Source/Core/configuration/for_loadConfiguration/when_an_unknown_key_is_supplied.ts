// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../../given.js';
import { loadConfiguration } from '../loadConfiguration.js';

should();
class an_unknown_setting {
    readonly variables = { CRATIS__ARC__UNKNOWN: 'secret' };
}

describe('when an unknown environment key is supplied', given(an_unknown_setting, context => {
    let failure: Error | undefined;
    beforeEach(() => {
        try { loadConfiguration('/nonexistent/appsettings.json', context.variables); }
        catch (error) { failure = error as Error; }
    });
    it('should report the unknown key without exposing its value', () => {
        failure!.message.should.contain('UNKNOWN');
        failure!.message.should.not.contain('secret');
    });
}));
