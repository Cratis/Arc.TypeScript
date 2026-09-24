// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from './ClassType.js';
import type { FieldOptions } from './FieldOptions.js';
import { store } from './metadataStore.js';
import { generatedMetadataFor } from './registerGeneratedMetadata.js';

/** Collect inherited field annotations in declaration order. */
export function readFieldOptions(type: ClassType, name: string): FieldOptions {
    const chain: object[] = [];
    for (let current: object | null = type; current && current !== Function.prototype;
        current = Object.getPrototypeOf(current)) chain.unshift(current);
    const result: FieldOptions = {};
    for (const current of chain) {
        const standard = Symbol.metadata && Reflect.get(current, Symbol.metadata) as object | undefined;
        Object.assign(result, generatedMetadataFor(current as ClassType)?.fieldOptions?.get(name),
            standard && store.get(standard)?.fieldOptions?.get(name), store.get(current)?.fieldOptions?.get(name));
    }
    return result;
}
