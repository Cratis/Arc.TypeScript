// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ArcApplicationServices, ServiceScope, ServiceToken } from '@cratis/arc.core';
import type { ClassType } from './ScenarioType.js';

/** Registers caller-owned fakes and constructed services before the first pipeline call. */
export class ScenarioServices {
    readonly #registrations: ((services: ArcApplicationServices) => void)[] = [];
    constructor(private readonly assertOpen: () => void) {}

    /** Register a caller-owned fake; Arc does not dispose it. */
    addSingleton<T extends object>(token: ServiceToken<T> | ClassType<T>, instance: T): this {
        this.assertOpen();
        this.#registrations.push(services => { services.registrations.push({ token, lifetime: 'singleton', instance }); });
        return this;
    }

    /** Register a factory-owned scoped service. */
    addScoped<T extends object>(token: ServiceToken<T> | ClassType<T>, factory: (scope: ServiceScope) => T | Promise<T>): this {
        this.assertOpen();
        this.#registrations.push(services => services.addScoped(token, factory));
        return this;
    }

    /** Register a factory-owned transient service, constructed on each resolution. */
    addTransient<T extends object>(token: ServiceToken<T> | ClassType<T>, factory: (scope: ServiceScope) => T | Promise<T>): this {
        this.assertOpen();
        this.#registrations.push(services => services.addTransient(token, factory));
        return this;
    }

    install(services: ArcApplicationServices): void {
        for (const register of this.#registrations) register(services);
        this.#registrations.length = 0;
    }
}
