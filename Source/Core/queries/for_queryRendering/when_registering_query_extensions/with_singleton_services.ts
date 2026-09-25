// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ServiceLifetime } from '../../../dependencyInjection/ServiceLifetime.js';
import { should } from 'vitest';
import { given } from '../../../given.js';
import { ArcServer } from '../../../ArcServer.js';
import { serviceToken } from '../../../dependencyInjection/ServiceToken.js';
import type { QueryRenderer } from '../../QueryRenderer.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
should();

class a_singleton_extension {
    readonly renderer = serviceToken<QueryRenderer>('singleton renderer');
    readonly interceptor = serviceToken<ReadModelInterceptor>('singleton interceptor');
    readonly services = [
        { token: this.renderer, lifetime: ServiceLifetime.Singleton as const, factory: () => ({ canRender: () => false,
            render: () => null }) },
        { token: this.interceptor, lifetime: ServiceLifetime.Singleton as const, factory: () => ({ model: Object,
            intercept: (value: object) => value }) }
    ];
}
describe('when registering query extensions with singleton services', given(a_singleton_extension, context => {
    it('should reject a singleton renderer', () => {
        (() => new ArcServer({ services: context.services, queryRenderers: [context.renderer] }))
            .should.throw('must not be singleton');
    });
    it('should reject a singleton interceptor', () => {
        (() => new ArcServer({ services: context.services, readModelInterceptors: [context.interceptor] }))
            .should.throw('must not be singleton');
    });
}));
