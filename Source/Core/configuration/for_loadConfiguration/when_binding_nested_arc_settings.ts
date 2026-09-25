// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { loadConfiguration } from '../loadConfiguration.js';

describe('when binding nested Arc settings from environment variables', () => {
    let options: ReturnType<typeof loadConfiguration>['Cratis'];
    beforeEach(() => {
        options = loadConfiguration('/nonexistent/appsettings.json', {
            Cratis__Arc__CorrelationId__HttpHeader: 'X-Request-ID',
            Cratis__Arc__Tenancy__ResolverType: 'Fixed',
            Cratis__Arc__Tenancy__FixedTenantId: 'north',
            Cratis__Arc__GeneratedApis__EnableQueryHttpMethod: 'False',
            Cratis__Arc__Query__KeepAliveInterval: '00:00:05',
            Cratis__Arc__Query__MaxObservableSubscriptions: '40',
            Cratis__Arc__Hosting__ApplicationUrl: 'http://127.0.0.1:5001/',
            Cratis__Arc__Hosting__MaxBodyBytes: '512',
            Cratis__Arc__ExposeExceptionDetails: 'True'
        }).Cratis;
    });
    it('should bind the .NET correlation and tenant paths', () => {
        options?.Arc?.correlationId?.httpHeader?.should.equal('X-Request-ID');
        options?.Arc?.tenancy?.resolverType?.should.equal('fixed');
        options?.Arc?.tenancy?.fixedTenantId?.should.equal('north');
    });
    it('should bind generated endpoint and exception options without enabling discovery', () => {
        options?.Arc?.generatedApis?.enableQueryHttpMethod?.should.equal(false);
        options?.Arc?.exposeExceptionDetails?.should.equal(true);
        should().equal(options?.Arc?.development, undefined);
    });
    it('should convert the .NET query interval into milliseconds and bind transport limits', () => {
        options?.Arc?.query?.keepAliveIntervalMs?.should.equal(5000);
        options?.Arc?.query?.maxObservableSubscriptions?.should.equal(40);
    });
    it('should bind Node hosting settings at the Hosting path', () => {
        options?.Arc?.hosting?.applicationUrl?.should.equal('http://127.0.0.1:5001/');
        options?.Arc?.hosting?.maxBodyBytes?.should.equal(512);
    });
});
