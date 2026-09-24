// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { given } from '../../given.js';
import { loadConfiguration } from '../loadConfiguration.js';

should();
class a_configuration_environment {
    readonly variables = { Cratis__Arc__Development: 'false', CRATIS__ARC__MAXBODYBYTES: '512', Cratis__Arc__OpenApiVersion: '2.0.0' };
}

describe('when environment overrides are provided', given(a_configuration_environment, context => {
    let configuration: ReturnType<typeof loadConfiguration>;
    beforeEach(() => {
        configuration = loadConfiguration(new URL('../../../../Samples/Tasks/appsettings.json', import.meta.url).pathname, context.variables);
    });
    it('should coerce boolean values', () => { configuration.Cratis?.Arc?.development?.should.equal(false); });
    it('should coerce numeric values', () => { configuration.Cratis?.Arc?.maxBodyBytes?.should.equal(512); });
    it('should bind the OpenAPI version', () => { configuration.Cratis?.Arc?.openApiVersion?.should.equal('2.0.0'); });
}));
