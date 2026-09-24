// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs } from '@cratis/fundamentals';
import { keyFieldFor } from '../reflection/key.js';
import type { ClassType } from '../reflection/ClassType.js';
import type { CanProvideKeyForCommand, CommandKeyResolver } from './CommandKeyResolver.js';
/** Resolves only keys explicitly composed by a command or marked with @key(). */
export class DefaultKeyForCommandResolver implements CommandKeyResolver {
    resolve(command: unknown): string | undefined {
        if (!command || typeof command !== 'object') return undefined;
        const provided = 'getKey' in command && typeof command.getKey === 'function'
            ? (command as CanProvideKeyForCommand).getKey() : undefined;
        if ('getKey' in command) return provided || undefined;
        const field = keyFieldFor(command.constructor as ClassType);
        const value = field ? Reflect.get(command, field) as unknown : undefined;
        const primitive = value instanceof ConceptAs ? Reflect.get(value as object, 'value') as unknown : value;
        return primitive === null || primitive === undefined ? undefined : String(primitive) || undefined;
    }
}
