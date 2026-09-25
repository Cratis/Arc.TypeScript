// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ConceptAs, Guid } from '@cratis/fundamentals';

/** Render supported identity values without accidentally persisting `[object Object]`. */
export function chronicleIdentity(value: unknown, label: string): string | undefined {
    if (value === undefined || value === null) return undefined;
    const primitive: unknown = value instanceof ConceptAs ? value.value : value;
    if (typeof primitive !== 'string' && typeof primitive !== 'number' && typeof primitive !== 'bigint' &&
        typeof primitive !== 'boolean' && !(primitive instanceof Guid)) throw new Error(`The command provided an invalid ${label}`);
    const text = String(primitive);
    if (text === '') return undefined;
    if (!text.trim()) throw new Error(`The command provided an invalid ${label}`);
    return text;
}
