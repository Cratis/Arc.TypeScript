// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { loadConfiguration } from '../../loadConfiguration.js';

for (const env of [{}, { Cratis__Arc__Introspection__Enabled: '0' }, { Cratis__Arc__Introspection__Enabled: 'no' }]) {
    describe(`when binding discovery enabled from invalid configuration ${JSON.stringify(env)}`, () => {
        let failure: unknown;
        beforeEach(() => {
            try { loadConfiguration(new URL('../given/introspection/invalid.json', import.meta.url), env); }
            catch (error) { failure = error; }
        });
        it('should reject invalid file or environment values', () => String(failure).should.contain('Cratis.Arc.introspection.enabled'));
    });
}
