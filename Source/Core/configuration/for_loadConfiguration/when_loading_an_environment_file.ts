// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { loadConfiguration } from '../loadConfiguration.js';

should();
describe('when loading an environment-specific settings file', () => {
    let settings: ReturnType<typeof loadConfiguration>;
    beforeEach(() => {
        settings = loadConfiguration(new URL('./given/appsettings.json', import.meta.url), { DOTNET_ENVIRONMENT: 'Development' });
    });
    it('should override the base file while retaining its other values', () => {
        settings.Cratis?.Arc?.generatedApis?.routePrefix?.should.equal('development');
        settings.Cratis?.Arc?.generatedApis?.includeCommandNameInRoute?.should.equal(true);
        settings.Cratis?.Arc?.generatedApis?.segmentsToSkipForRoute?.should.equal(2);
    });
    it('should accept string-valued numeric settings', () => { settings.Cratis?.Arc?.maxBodyBytes?.should.equal(1024); });
});
