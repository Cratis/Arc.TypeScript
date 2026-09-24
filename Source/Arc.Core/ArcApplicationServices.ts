// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceRegistration } from './dependencyInjection/ServiceRegistration.js';
import type { ServiceIdentifier, ServiceClass } from './dependencyInjection/ServiceIdentifier.js';
import { reflectedParameters } from './reflection/dependencies.js';
import { ownMetadata } from './reflection/metadata.js';
import type { ServiceScope } from './dependencyInjection/ServiceScope.js';

/** Collect class and factory registrations for a built application. */
export class ArcApplicationServices {
    readonly registrations: ServiceRegistration<unknown>[] = [];
    /** Register a service once for the lifetime of the application. */
    addSingleton<T>(token: ServiceIdentifier<T>, implementation?: ServiceClass<T> | ((scope: ServiceScope) => T | Promise<T>)): this {
        return this.add(token, 'singleton', implementation);
    }
    /** Register a service once in each execution scope. */
    addScoped<T>(token: ServiceIdentifier<T>, implementation?: ServiceClass<T> | ((scope: ServiceScope) => T | Promise<T>)): this {
        return this.add(token, 'scoped', implementation);
    }
    /** Register a service once per resolution. */
    addTransient<T>(token: ServiceIdentifier<T>, implementation?: ServiceClass<T> | ((scope: ServiceScope) => T | Promise<T>)): this {
        return this.add(token, 'transient', implementation);
    }
    private add<T>(token: ServiceIdentifier<T>, lifetime: 'singleton' | 'scoped' | 'transient',
        implementation?: ServiceClass<T> | ((scope: ServiceScope) => T | Promise<T>)): this {
        const concrete = implementation ?? (typeof token === 'function' ? token : undefined);
        if (!concrete) throw new Error(`Service ${token.name} requires an implementation`);
        const isClass = typeof token === 'function' && implementation === undefined ||
            typeof concrete === 'function' && /^class[\s{]/.test(Function.prototype.toString.call(concrete));
        if (!isClass) {
            this.registrations.push({ token, lifetime, factory: (scope: ServiceScope) => (concrete as (scope: ServiceScope) => T | Promise<T>)(scope) });
            return this;
        }
        const type = concrete as ServiceClass<T>;
        const metadata = ownMetadata(type);
        const staticTokens = Reflect.get(type, 'inject') as readonly ServiceIdentifier<unknown>[] | undefined;
        let tokens = metadata.constructorTokens ?? staticTokens ?? [];
        if (!tokens.length && type.length) tokens = reflectedParameters(type, 'constructor', type.length);
        if (tokens.length !== type.length) throw new Error(`Unbound constructor parameters on ${type.name}`);
        this.registrations.push({ token, lifetime, dependencies: tokens, factory: async (scope: ServiceScope) => {
            const dependencies = await Promise.all(tokens.map(dependency => scope.resolve(dependency)));
            return Reflect.construct(type, dependencies) as T;
        } });
        return this;
    }
}
