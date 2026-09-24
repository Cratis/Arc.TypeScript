// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplicationBuilder } from '@cratis/arc.core';
import type { Constructor } from '@cratis/fundamentals';
import { ChronicleArtifacts } from './ChronicleArtifacts.js';
import { ChronicleReadModels } from './ChronicleReadModels.js';
import { ChronicleReadModelForCommandResolver } from './ChronicleReadModelForCommandResolver.js';
import { ChronicleResponseHandler } from './ChronicleResponseHandler.js';
import { ChronicleCommandKeyResolver } from './ChronicleCommandKeyResolver.js';
import { ChronicleRuntime } from './ChronicleRuntime.js';
import type { ChronicleRegistration } from './ChronicleOptions.js';
import { runChronicleCommand } from './runChronicleCommand.js';

/** Register Chronicle without changing core Arc's optional dependency boundary. */
export function withChronicle(builder: ArcApplicationBuilder, options: Partial<ChronicleRegistration> = {}): ArcApplicationBuilder {
    const registration = { ...builder.configuration.Cratis?.Chronicle, ...options };
    if (!registration.eventStore || (!registration.connectionString && !registration.client) ||
        (registration.connectionString && registration.client)) throw new Error('Chronicle requires eventStore and exactly one of connectionString or client');
    const artifacts = new ChronicleArtifacts();
    builder.addArtifactObserver(type => artifacts.register(type as Constructor));
    builder.services.addSingleton(ChronicleRuntime, () => new ChronicleRuntime(registration as ChronicleRegistration, artifacts));
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
    return builder;
}

declare module '@cratis/arc.core' {
    interface ArcBuilderIntegrationOptions { chronicle: Partial<ChronicleRegistration>; }
}

/** @deprecated Use withChronicle. */
export const addChronicle = withChronicle;
ArcApplicationBuilder.registerExtension('chronicle', withChronicle);
