// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Constructor } from '@cratis/fundamentals';
import { DecoratorType, TypeDiscoverer, TypeIntrospector } from '@cratis/chronicle/types';
import { getProjectionMetadata, hasFromEventMetadata, getSetFromMetadata, getSetFromContextMetadata,
    getSetValueMetadata, getAddFromMetadata, getSubtractFromMetadata, getIncrementMetadata,
    getDecrementMetadata, getCountMetadata, getChildrenFromMetadata, getJoinMetadata,
    getFromEveryMetadata, getFromAllMetadata } from '@cratis/chronicle/projections';
import { getReducerMetadata } from '@cratis/chronicle/reducers';
import type { IClientArtifactsProvider } from '@cratis/chronicle/artifacts';
import { hasEventType } from '@cratis/chronicle/events';
import { getReadModelMetadata } from '@cratis/chronicle/readModels';

const mappings = [getSetFromMetadata, getSetFromContextMetadata, getSetValueMetadata,
    getAddFromMetadata, getSubtractFromMetadata, getIncrementMetadata, getDecrementMetadata,
    getCountMetadata, getChildrenFromMetadata, getJoinMetadata];
function hasModelBoundMappings(type: Constructor): boolean {
    return TypeIntrospector.getTrackedProperties(type).some(property =>
        mappings.some(metadata => metadata(type.prototype, property).length > 0) ||
        !!getFromEveryMetadata(type.prototype, property) || !!getFromAllMetadata(type.prototype, property));
}

/** Explicit per-application artifact catalog, independent of the SDK's process-wide discovery provider. */
export class ChronicleArtifacts implements IClientArtifactsProvider {
    readonly #types = new Map<DecoratorType, Set<Constructor>>();
    /** Record a Chronicle-decorated class imported by Arc's discovery or add(). */
    register(type: Constructor): boolean {
        let matched = false;
        for (const kind of Object.values(DecoratorType)) {
            if (kind === DecoratorType.EventType ? hasEventType(type) : kind === DecoratorType.ReadModel
                ? !!getReadModelMetadata(type) || hasFromEventMetadata(type) ||
                    hasModelBoundMappings(type)
                : TypeDiscoverer.default.getTypesByDecoratorType(kind).includes(type)) {
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
    get readModels(): Constructor[] {
        const types = new Set(this.of(DecoratorType.ReadModel));
        for (const projection of this.projections) {
            const model = getProjectionMetadata(projection)?.readModelType;
            if (model) types.add(model);
        }
        for (const reducer of this.reducers) {
            const model = getReducerMetadata(reducer)?.readModel;
            if (model) types.add(model);
        }
        return [...types];
    }
    get reactors(): Constructor[] { return this.of(DecoratorType.Reactor); }
    get reducers(): Constructor[] { return this.of(DecoratorType.Reducer); }
    /** Whether a model is populated by a registered declarative or model-bound projection. */
    hasProjectionFor(model: Constructor): boolean {
        return hasFromEventMetadata(model) || hasModelBoundMappings(model) ||
            this.projections.some(type => getProjectionMetadata(type)?.readModelType === model);
    }
    get seeders(): Constructor[] { return this.of(DecoratorType.Seeder); }
    get constraints(): Constructor[] { return this.of(DecoratorType.Constraint); }
    get projections(): Constructor[] { return this.of(DecoratorType.Projection); }
    get webhooks(): Constructor[] { return this.of(DecoratorType.Webhook); }
    get eventTypeMigrations(): Constructor[] { return this.of(DecoratorType.EventTypeMigration); }
    get globalForHandlers(): Constructor[] { return this.of(DecoratorType.GlobalForHandler); }
}
