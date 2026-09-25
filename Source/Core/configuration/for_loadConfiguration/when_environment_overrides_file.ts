// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../../given.js';
import { loadConfiguration } from '../loadConfiguration.js';

should();
class a_configuration_environment {
    readonly variables = { Cratis__Arc__Development: 'false', CRATIS__ARC__HOSTING__MAXBODYBYTES: '512', Cratis__Arc__GeneratedApis__OpenApiVersion: '2.0.0' };
}

describe('when environment overrides are provided', given(a_configuration_environment, context => {
    let configuration: ReturnType<typeof loadConfiguration>;
    beforeEach(() => {
        configuration = loadConfiguration(new URL('./given/appsettings.json', import.meta.url), context.variables);
    });
    it('should coerce boolean values', () => { configuration.Cratis?.Arc?.development?.should.equal(false); });
    it('should coerce numeric values', () => { configuration.Cratis?.Arc?.hosting?.maxBodyBytes?.should.equal(512); });
    it('should bind the OpenAPI version', () => { configuration.Cratis?.Arc?.generatedApis?.openApiVersion?.should.equal('2.0.0'); });
    it('should preserve string-valued event store IDs', () => { configuration.Cratis?.Chronicle?.eventStore?.should.equal('2024'); });
}));
