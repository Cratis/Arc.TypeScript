// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from '../reflection/ClassType.js';
import type { CommandContext } from './CommandContext.js';

/** Resolve a registered read model using the command's trusted, resolved key. */
export interface ReadModelForCommandResolver {
    supports(type: ClassType): boolean;
    find<T>(type: ClassType<T>, key: string, context: CommandContext): Promise<T | null>;
}
