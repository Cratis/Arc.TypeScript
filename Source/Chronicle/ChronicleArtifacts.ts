// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer } from '@cratis/chronicle/types';
import type { IClientArtifactsProvider } from '@cratis/chronicle/artifacts';
import { hasEventType } from '@cratis/chronicle/events';
import { getReadModelMetadata } from '@cratis/chronicle/readModels';

/** Explicit per-application artifact catalog, independent of the SDK's process-wide discovery provider. */
export class ChronicleArtifacts implements IClientArtifactsProvider {
    readonly #types = new Map<DecoratorType, Set<Constructor>>();
    /** Record a Chronicle-decorated class imported by Arc's discovery or add(). */
    register(type: Constructor): boolean {
        let matched = false;
        for (const kind of Object.values(DecoratorType)) {
            if (kind === DecoratorType.EventType ? hasEventType(type) : kind === DecoratorType.ReadModel
                ? !!getReadModelMetadata(type) : TypeDiscoverer.default.getTypesByDecoratorType(kind).includes(type)) {
                const types = this.#types.get(kind) ?? new Set<Constructor>();
                types.add(type);
                this.#types.set(kind, types);
                matched = true;
            }
        }
        return matched;
    }
    private of(kind: DecoratorType): Constructor[] { return [...this.#types.get(kind) ?? []]; }
    get eventTypes(): Constructor[] { return this.of(DecoratorType.EventType); }
    get readModels(): Constructor[] { return this.of(DecoratorType.ReadModel); }
    get reactors(): Constructor[] { return this.of(DecoratorType.Reactor); }
    get reducers(): Constructor[] { return this.of(DecoratorType.Reducer); }
    get seeders(): Constructor[] { return this.of(DecoratorType.Seeder); }
    get constraints(): Constructor[] { return this.of(DecoratorType.Constraint); }
    get projections(): Constructor[] { return this.of(DecoratorType.Projection); }
    get webhooks(): Constructor[] { return this.of(DecoratorType.Webhook); }
    get eventTypeMigrations(): Constructor[] { return this.of(DecoratorType.EventTypeMigration); }
    get globalForHandlers(): Constructor[] { return this.of(DecoratorType.GlobalForHandler); }
}
