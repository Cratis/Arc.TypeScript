// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplicationBuilder } from '@cratis/arc.core';
import type { ArcServer } from '@cratis/arc.core';
import type { Constructor } from '@cratis/fundamentals';
import { ChronicleArtifacts } from './ChronicleArtifacts.js';
import { ChronicleReadModels } from './ChronicleReadModels.js';
import { ChronicleReadModelForCommandResolver } from './ChronicleReadModelForCommandResolver.js';
import { ChronicleResponseHandler } from './ChronicleResponseHandler.js';
import { ChronicleCommandKeyResolver } from './ChronicleCommandKeyResolver.js';
import { ChronicleRuntime } from './ChronicleRuntime.js';
import type { ChronicleRegistration } from './ChronicleOptions.js';
import { runChronicleCommand } from './runChronicleCommand.js';
import { ChronicleCommandScope } from './ChronicleCommandScope.js';

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
    builder.addArtifactObserver(type => artifacts.register(type as Constructor));
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
    builder.addCommandExecutionScope(() => new ChronicleCommandScope());
    return builder;
}

declare module '@cratis/arc.core' {
    interface ArcBuilderIntegrationOptions { chronicle: Partial<ChronicleRegistration>; }
}

/** @deprecated Use withChronicle. */
export const addChronicle = withChronicle;
ArcApplicationBuilder.registerExtension('chronicle', withChronicle);
