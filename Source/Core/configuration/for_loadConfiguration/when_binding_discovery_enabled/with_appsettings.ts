// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { loadConfiguration, type CratisConfiguration } from '../../loadConfiguration.js';

for (const [environment, enabled] of [['Development', true], ['Production', false]] as const) {
    describe(`when binding discovery enabled from appsettings in ${environment}`, () => {
        let settings: CratisConfiguration;
        beforeEach(() => {
            settings = loadConfiguration(new URL('../given/introspection/appsettings.json', import.meta.url), { DOTNET_ENVIRONMENT: environment });
        });
        it('should bind the boolean from the effective environment file', () => settings.Cratis!.Arc!.introspection!.enabled!.should.equal(enabled));
    });
}
