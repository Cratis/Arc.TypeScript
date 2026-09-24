// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
const excluded = new WeakMap<object, Set<string>>();
/** Exclude a secret command field from Chronicle's permanent causation chain. */
export function notAudited(): (target: object | undefined, nameOrContext: string | ClassFieldDecoratorContext) => void {
    return (target, nameOrContext) => {
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string' || standard && (nameOrContext.kind !== 'field' || nameOrContext.static || nameOrContext.private))
            throw new Error('@notAudited requires a public instance field');
        const register = (constructor: object): void => {
            const fields = excluded.get(constructor) ?? new Set<string>();
            fields.add(name);
            excluded.set(constructor, fields);
        };
        if (standard) nameOrContext.addInitializer(function (this: unknown) { register((this as object).constructor); });
        else register(target!.constructor);
    };
}
/** Read exclusions for an initialized command instance. */
export function notAuditedFields(type: object): ReadonlySet<string> { return excluded.get(type) ?? new Set<string>(); }
