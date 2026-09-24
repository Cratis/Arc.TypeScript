// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fieldOption } from './fieldOption.js';

/** Restrict scalar wire values to the members of an enum object. */
export function enumeration(values: object): ReturnType<typeof fieldOption> {
    const entries = Object.entries(values as Record<string, unknown>);
    const members = entries.filter(([name, value]) => !(
        typeof value === 'string' && typeof (values as Record<string, unknown>)[value] === 'number' &&
        String((values as Record<string, unknown>)[value]) === name));
    return fieldOption({ values: [...new Set(members.map(([, value]) => value).filter(
        (value): value is string | number | boolean =>
            typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'))] });
}
