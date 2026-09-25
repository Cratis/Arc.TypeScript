// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { loadConfiguration } from '../loadConfiguration.js';

should();
describe('when using .NET ArcOptions paths', () => {
    let settings: ReturnType<typeof loadConfiguration>;
    beforeEach(() => {
        settings = loadConfiguration(new URL('./given/appsettings.json', import.meta.url), {
            Cratis__Arc__CorrelationId__HttpHeader: 'x-correlation',
            Cratis__Arc__Tenancy__HttpHeader: 'x-tenant',
            Cratis__Arc__GeneratedApis__EnableQueryHttpMethod: 'False',
            Cratis__Arc__ExposeExceptionDetails: 'True',
            Cratis__Chronicle__EventStore: '2024',
            Cratis__Arc__GeneratedApis__OpenApiVersion: '3'
        });
    });
    it('should bind headers', () => {
        settings.Cratis?.Arc?.correlationId?.httpHeader?.should.equal('x-correlation');
        settings.Cratis?.Arc?.tenancy?.httpHeader?.should.equal('x-tenant');
    });
    it('should bind HTTP and exception options', () => {
        settings.Cratis?.Arc?.generatedApis?.enableQueryHttpMethod?.should.equal(false);
        settings.Cratis?.Arc?.exposeExceptionDetails?.should.equal(true);
    });
    it('should keep numeric-looking names as strings', () => {
        settings.Cratis?.Chronicle?.eventStore?.should.equal('2024');
        settings.Cratis?.Arc?.generatedApis?.openApiVersion?.should.equal('3');
    });
});
