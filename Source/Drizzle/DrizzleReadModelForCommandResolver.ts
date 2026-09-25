// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { currentServices } from '@cratis/arc.core';
import type { ClassType, ReadModelForCommandResolver } from '@cratis/arc.core';
import type { DrizzleOptions } from './DrizzleOptions.js';
import { drizzleReadModel } from './drizzleToken.js';

/** Resolve registered Drizzle models by the command key in the current tenant scope. */
export class DrizzleReadModelForCommandResolver implements ReadModelForCommandResolver {
    constructor(private readonly options: DrizzleOptions) {}
    supports(type: ClassType): boolean { return !!this.options.readModels?.some(model => model.type === type); }
    async find<T>(type: ClassType<T>, key: string): Promise<T | null> {
        const models = await currentServices().resolve(drizzleReadModel(type as unknown as new () => object));
        return models.findById(key) as Promise<T | null>;
    }
}
