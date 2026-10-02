// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { loadConfiguration, type CratisConfiguration } from '../../loadConfiguration.js';

for (const value of ['true', 'false', 'TRUE', 'FALSE']) describe(`when binding discovery enabled from environment value ${value}`, () => {
    let settings: CratisConfiguration;
    beforeEach(() => {
        settings = loadConfiguration(new URL('../given/introspection/appsettings.json', import.meta.url), {
            Cratis__Arc__Introspection__Enabled: value
        });
    });
    it('should bind the environment boolean over the file setting', () => settings.Cratis!.Arc!.introspection!.enabled!.should.equal(value.toLowerCase() === 'true'));
});
