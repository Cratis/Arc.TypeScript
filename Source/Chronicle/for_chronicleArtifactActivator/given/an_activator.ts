// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplicationBuilder } from '@cratis/arc.core';
import type { ArcServer } from '@cratis/arc.core';
import { ArtifactCompletionFailed, ArtifactDelivery, ArtifactKind } from '@cratis/chronicle/artifacts';
import type { ActivatedArtifact, ArtifactActivationContext } from '@cratis/chronicle/artifacts';
import type { Constructor } from '@cratis/fundamentals';
import { chronicleArtifactActivator, type ChronicleArtifactActivator } from '../../chronicleArtifactActivator.js';
import { ActivatedReactor, Dependency, disposals, FailingCleanup, ReactorThatCannotBeConstructed, ReactorWithFailingCleanup,
    SingletonReactor } from './artifacts.js';

type BuiltApplication = Awaited<ReturnType<ArcApplicationBuilder['build']>>;

export class an_activator {
    readonly store = 'Orders';
    readonly tenant = 'tenant-a';
    readonly readModels = {};
    delivery = new AbortController();
    builder = new ArcApplicationBuilder();
    application!: BuiltApplication;
    activator!: ChronicleArtifactActivator;

    get server(): ArcServer { return this.application.server; }

    async build(): Promise<void> {
        disposals.length = 0;
        this.delivery = new AbortController();
        this.builder = new ArcApplicationBuilder();
        this.builder.services.addScoped(Dependency).addScoped(FailingCleanup).addScoped(ActivatedReactor)
            .addScoped(ReactorWithFailingCleanup).addScoped(ReactorThatCannotBeConstructed).addSingleton(SingletonReactor);
        this.application = await this.builder.build();
        this.activator = chronicleArtifactActivator(() => this.application.server, this.store);
    }

    /** An event delivery observed on the given store; the first event carries the given correlation. */
    events(correlationId: string, store = this.store, readModels: object = this.readModels): ArtifactActivationContext {
        return { ...this.common(store, readModels), delivery: ArtifactDelivery.Events,
            eventContext: { correlationId } } as unknown as ArtifactActivationContext;
    }

    replayNotification(): ArtifactActivationContext {
        return { ...this.common(this.store, this.readModels), delivery: ArtifactDelivery.ReplayNotification,
            replayState: {} } as unknown as ArtifactActivationContext;
    }

    activate<T>(type: Constructor<T>, context: ArtifactActivationContext): Promise<ActivatedArtifact<T>> {
        return Promise.resolve(this.activator(type, context));
    }

    /** Mirrors the SDK delivery contract: process, complete before acknowledgement, then always dispose. */
    async deliver<T>(type: Constructor<T>, context: ArtifactActivationContext,
        process: (artifact: ActivatedArtifact<T>) => Promise<void>): Promise<void> {
        const artifact = await this.activate(type, context);
        try {
            let processingError: unknown;
            let failed = false;
            try { await process(artifact); } catch (error) { failed = true; processingError = error; }
            try { await artifact.complete?.(); }
            catch (error) { throw new ArtifactCompletionFailed(error, failed ? processingError : undefined); }
            if (failed) throw processingError;
        } finally {
            try { await artifact.dispose?.(); } catch { /* The SDK logs a dispose failure. */ }
        }
    }

    async dispose(): Promise<void> { await this.application?.dispose(); }

    private common(store: string, readModels: object) {
        return {
            kind: ArtifactKind.Reactor, artifactId: 'orders-reactor', eventSequenceId: 'event-log', partition: 'order-1',
            signal: this.delivery.signal, readModels,
            eventStore: { name: { value: store }, namespace: { value: this.tenant }, readModels: this.readModels }
        };
    }
}
