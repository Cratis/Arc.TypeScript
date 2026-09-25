// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType, CommandContext, ReadModelForCommandResolver } from '@cratis/arc.core';
import type { ChronicleArtifacts } from './ChronicleArtifacts.js';
import { ChronicleRuntime } from './ChronicleRuntime.js';
import { hasProjectedCompliance } from './hasProjectedCompliance.js';

/** Resolve only registered Chronicle read models in the command's trusted namespace. */
export class ChronicleReadModelForCommandResolver implements ReadModelForCommandResolver {
    constructor(private readonly runtime: ChronicleRuntime, private readonly artifacts: ChronicleArtifacts) {}
    supports(type: ClassType): boolean { return this.artifacts.readModels.includes(type as never); }
    async find<T>(type: ClassType<T>, key: string, context: CommandContext): Promise<T | null> {
        const store = await this.runtime.getStore(context);
        const model = await store.readModels.findInstanceById(type as never, key) as T | null;
        if (model === null || !hasProjectedCompliance(type as never, this.artifacts)) return model;
        return store.readModels.release(type as never, model);
    }
}
