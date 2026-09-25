// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { currentServices } from '@cratis/arc.core';
import type { ClassType, ReadModelForCommandResolver } from '@cratis/arc.core';
import { drizzleReadModel } from './drizzleToken.js';

/** Resolve registered Drizzle models by the command key in the current tenant scope. */
export class DrizzleReadModelForCommandResolver implements ReadModelForCommandResolver {
    constructor(private readonly commandModels: ReadonlySet<ClassType>) {}
    supports(type: ClassType): boolean { return this.commandModels.has(type); }
    async find<T>(type: ClassType<T>, key: string): Promise<T | null> {
        const models = await currentServices().resolve(drizzleReadModel(type as unknown as new () => object));
        return models.findById(key) as Promise<T | null>;
    }
}
