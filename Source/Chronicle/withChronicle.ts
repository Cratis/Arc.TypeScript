// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplicationBuilder, serviceToken } from '@cratis/arc.core';
import type { ArcServer, ReadModelInterceptor } from '@cratis/arc.core';
import { ArcApplicationBuilder as FetchArcApplicationBuilder } from '@cratis/arc.core/fetch';
import type { Constructor } from '@cratis/fundamentals';
import { ChronicleArtifacts } from './ChronicleArtifacts.js';
import { ChronicleReadModels } from './ChronicleReadModels.js';
import { ChronicleReadModelInterceptor } from './ChronicleReadModelInterceptor.js';
import { ChronicleReadModelForCommandResolver } from './ChronicleReadModelForCommandResolver.js';
import { ChronicleResponseHandler } from './ChronicleResponseHandler.js';
import { ChronicleCommandKeyResolver } from './ChronicleCommandKeyResolver.js';
import { ChronicleRuntime } from './ChronicleRuntime.js';
import type { ChronicleRegistration } from './ChronicleOptions.js';
import { runChronicleCommand } from './runChronicleCommand.js';
import { ChronicleCommandScope } from './ChronicleCommandScope.js';
import { hasProtectedReadModel } from './hasProtectedReadModel.js';

/** Register Chronicle without changing core Arc's optional dependency boundary. */
export function withChronicle(builder: ArcApplicationBuilder, options: Partial<ChronicleRegistration> = {}): ArcApplicationBuilder {
    const configured = { ...builder.configuration.Cratis?.Chronicle };
    if (options.client || options.connectionString) delete configured.connectionString;
    const registration = { ...configured, ...options };
    if (!registration.eventStore || (!registration.connectionString && !registration.client) ||
        (registration.connectionString && registration.client)) throw new Error('Chronicle requires eventStore and exactly one of connectionString or client');
    const artifacts = new ChronicleArtifacts();
    let server: ArcServer | undefined;
    builder.addBuiltObserver(built => { server = built; });
    const registeredInterceptors = new Set<Constructor>();
    builder.addArtifactObserver(type => {
        const matched = artifacts.register(type as Constructor);
        for (const model of artifacts.readModels) {
            if (registeredInterceptors.has(model) || !hasProtectedReadModel(model)) continue;
            registeredInterceptors.add(model);
            const token = serviceToken<ReadModelInterceptor>(`Chronicle read model release: ${model.name}`);
            builder.services.addScoped(token, async scope =>
                new ChronicleReadModelInterceptor(model as Constructor<object>, await scope.resolve(ChronicleRuntime), scope.identity!));
            builder.addReadModelInterceptor(token);
        }
        return matched;
    });
    builder.services.addSingleton(ChronicleRuntime, () => new ChronicleRuntime(registration as ChronicleRegistration, artifacts, () => {
        if (!server) throw new Error('Arc must be built before Chronicle reactor commands can run');
        return server;
    }));
    builder.services.addScoped(ChronicleReadModels, async scope =>
        new ChronicleReadModels(await scope.resolve(ChronicleRuntime), scope.identity!));
    builder.services.addScoped(ChronicleReadModelForCommandResolver, async scope =>
        new ChronicleReadModelForCommandResolver(await scope.resolve(ChronicleRuntime), artifacts));
    builder.addReadModelForCommandResolver(ChronicleReadModelForCommandResolver);
    builder.services.addScoped(ChronicleResponseHandler, async scope =>
        new ChronicleResponseHandler(await scope.resolve(ChronicleRuntime)));
    builder.addCommandResponseValueHandler(ChronicleResponseHandler);
    builder.services.addScoped(ChronicleCommandKeyResolver);
    builder.addCommandKeyResolver(ChronicleCommandKeyResolver);
    builder.addCommandExecutionRunner(runChronicleCommand);
    builder.addCommandExecutionScope(() => new ChronicleCommandScope(registration.completionTimeoutMs));
    return builder;
}

declare module '@cratis/arc.core/fetch' {
    interface ArcBuilderExtensions {
        /** Attach Chronicle after importing @cratis/arc.chronicle. */
        withChronicle(options: Partial<ChronicleRegistration>): this;
    }
}

ArcApplicationBuilder.registerExtension('chronicle', withChronicle);
ArcApplicationBuilder.prototype.withChronicle = function (options: Partial<ChronicleRegistration>) {
    return this.extend('chronicle', options);
};
FetchArcApplicationBuilder.prototype.withChronicle = function (options: Partial<ChronicleRegistration>) {
    return this.extend('chronicle', options);
};
