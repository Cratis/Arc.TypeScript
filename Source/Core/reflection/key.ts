// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fieldOption } from './fieldOption.js';
import { memberMetadata } from './memberMetadata.js';
import { ownMetadata } from './ownMetadata.js';
import type { ClassType } from './ClassType.js';

/** Mark the sole field used as the command key and as the read-model identity for storage integrations. */
export function key(): (target: object | undefined, nameOrContext: string | symbol | ClassFieldDecoratorContext) => void {
    return (target, nameOrContext) => {
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string' || standard && (nameOrContext.kind !== 'field' || nameOrContext.static || nameOrContext.private))
            throw new Error('@key requires a public instance field');
        const metadata = memberMetadata(target ?? {}, name, standard ? nameOrContext : undefined);
        if (metadata.keyField && metadata.keyField !== name) throw new Error('A command may mark only one key');
        metadata.keyField = name;
        fieldOption({ key: true })(target, nameOrContext);
    };
}
/** Read the explicitly marked field from either decorator mode. */
export function keyFieldFor(type: ClassType): string | undefined {
    for (let current: ClassType | undefined = type; current && current !== Function.prototype;
        current = Object.getPrototypeOf(current) as ClassType | undefined) {
        const field = ownMetadata(current).keyField;
        if (field) return field;
    }
    return undefined;
}
