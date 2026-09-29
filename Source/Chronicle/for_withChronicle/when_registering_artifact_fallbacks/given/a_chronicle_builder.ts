// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplicationBuilder, Severity } from '@cratis/arc.core';
import type { ArcOptions, ServiceIdentifier, ServiceRegistration, ServiceScope } from '@cratis/arc.core';
import type { IChronicleClient } from '@cratis/chronicle';
import { withChronicle } from '../../../withChronicle.js';

type BuiltApplication = Awaited<ReturnType<ArcApplicationBuilder['build']>>;

export class a_chronicle_builder {
    readonly client = { getEventStore: async () => ({}) } as unknown as IChronicleClient;
    builder = new ArcApplicationBuilder();
    application: BuiltApplication | undefined;
    options: ArcOptions = {};

    start(options: ArcOptions = {}): this { this.options = options; this.builder = new ArcApplicationBuilder(options); this.application = undefined; return this; }

    withChronicle(): this { withChronicle(this.builder, { client: this.client, eventStore: 'Fallbacks' }); return this; }
    async build(): Promise<BuiltApplication> { this.application = await this.builder.build(); return this.application; }
    registrationsFor(token: ServiceIdentifier<unknown>): ServiceRegistration<unknown>[] {
        return this.builder.services.registrations.filter(registration => registration.token === token);
    }
    registration(token: ServiceIdentifier<unknown>): ServiceRegistration<unknown> {
        const supplied = Array.isArray(this.options.services) ? this.options.services : [];
        return [...supplied, ...this.builder.services.registrations].find(registration => registration.token === token)!;
    }
    async inScope<T>(callback: (scope: ServiceScope) => Promise<T>): Promise<T> {
        const scope = this.application!.server.services.createScope({ tenantId: 'tenant', correlationId: crypto.randomUUID(),
            principal: undefined, signal: new AbortController().signal, allowedSeverity: Severity.Error });
        try { return await callback(scope); } finally { await scope.dispose(); }
    }
    async dispose(): Promise<void> { await this.application?.dispose(); }
}
