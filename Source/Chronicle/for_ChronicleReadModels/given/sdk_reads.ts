// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import type { Constructor } from '@cratis/fundamentals';
import { pii } from '@cratis/chronicle/compliance';
import { encrypted } from '@cratis/chronicle/confidentiality';
import { eventType } from '@cratis/chronicle/events';
import { fromEvent } from '@cratis/chronicle/projections';
import { reducer } from '@cratis/chronicle/reducers';
import { readModel } from '@cratis/arc.core';
import type { ExecutionContext } from '@cratis/arc.core';
import type { IEventStore } from '@cratis/chronicle';
import { ChronicleArtifacts } from '../../ChronicleArtifacts.js';
import { ChronicleReadModelInterceptor } from '../../ChronicleReadModelInterceptor.js';
import { ChronicleReadModels } from '../../ChronicleReadModels.js';
import type { ChronicleRuntime } from '../../ChronicleRuntime.js';

@eventType() class Happened { @field(String) name = ''; }
export class InnerValue { @field(String) @pii() value = ''; }
/** Reducer model protected only below the top level: the SDK does not release it. */
export class NestedReduced { @field(String) id = ''; @field(InnerValue) inner = new InnerValue(); }
/** Reducer model protected only by encryption: the SDK does not release it. */
export class EncryptedReduced { @field(String) id = ''; @field(String) @encrypted() secret = ''; }
/** Reducer model with top-level compliance metadata: the SDK releases it. */
export class TopLevelReduced { @field(String) id = ''; @field(String) @pii() name = ''; }
@readModel() @fromEvent(Happened)
export class ProjectedView { @field(String) id = ''; @field(String) @pii() name = ''; }
/** Model with no protected data. */
export class Unprotected { @field(String) id = ''; @field(String) name = ''; }
@reducer('nested-reduced', undefined, NestedReduced) class NestedReducer {}
@reducer('encrypted-reduced', undefined, EncryptedReduced) class EncryptedReducer {}
@reducer('top-level-reduced', undefined, TopLevelReduced) class TopLevelReducer {}

export class sdk_reads {
    readonly artifacts = new ChronicleArtifacts();
    readonly context = { tenantId: 'tenant-a' } as ExecutionContext;
    removed = false;
    readonly store = { readModels: {
        findInstanceById: async (type: Constructor) => new type(),
        getInstances: async (type: Constructor) => [new type()],
        watch: async function* (this: sdk_reads, type: Constructor) {
            // A removal carries the last state, which the kernel releases for projections.
            const readModel = this.removed ? Object.assign(new type(), { name: 'last' }) : new type();
            yield { key: '1', readModel, removed: this.removed };
        }.bind(this)
    } } as unknown as IEventStore;
    readonly runtime = { getStore: async () => this.store, artifacts: this.artifacts } as unknown as ChronicleRuntime;
    readonly models = new ChronicleReadModels(this.runtime, this.context);
    constructor() {
        for (const type of [Happened, ProjectedView, NestedReducer, EncryptedReducer, TopLevelReducer]) this.artifacts.register(type);
    }
    isReleased(type: Constructor<object>, model: object): boolean {
        return new ChronicleReadModelInterceptor(type, this.runtime, this.context).isReleased(model);
    }
    async watched(type: Constructor<object>): Promise<object> {
        for await (const change of this.models.watchIterable(type)) return change.readModel as object;
        throw new Error('No change');
    }
}
