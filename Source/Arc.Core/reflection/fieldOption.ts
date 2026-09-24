// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { memberMetadata } from './memberMetadata.js';
import type { FieldOptions } from './FieldOptions.js';

/** Apply a field annotation to a public instance field. */
export function fieldOption(option: FieldOptions): (
    target: object | undefined, nameOrContext: string | symbol | ClassFieldDecoratorContext) => void {
    return (target, nameOrContext) => {
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string' || standard && (nameOrContext.kind !== 'field' || nameOrContext.static || nameOrContext.private))
            throw new Error('Field annotation requires a public instance field');
        const data = memberMetadata(target ?? {}, name, standard ? nameOrContext : undefined);
        data.fieldOptions = new Map(data.fieldOptions);
        data.fieldOptions.set(name, { ...data.fieldOptions.get(name), ...option });
    };
}
