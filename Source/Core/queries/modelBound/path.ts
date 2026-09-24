// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { metadataFor } from '../../reflection/metadataFor.js';
import { memberMetadata } from '../../reflection/memberMetadata.js';
import type { DualClassDecorator } from '../../reflection/DualClassDecorator.js';
import type { SimpleMemberDecorator } from '../../reflection/SimpleMemberDecorator.js';

/** Override an endpoint's conventional path, like .NET's Path attribute. */
export function path(path: string): DualClassDecorator & SimpleMemberDecorator {
    return ((target: object, nameOrContext?: string | symbol | ClassMethodDecoratorContext | ClassDecoratorContext) => {
        if (nameOrContext === undefined || typeof nameOrContext === 'object' && nameOrContext.kind === 'class') {
            metadataFor(target).path = path;
            return;
        }
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string') throw new Error('Route requires a named declaration');
        const data = memberMetadata(target, name, standard ? nameOrContext : undefined);
        data.methodRoutes = new Map(data.methodRoutes);
        if (data.methodRoutes.has(name)) throw new Error(`Duplicate @path on ${name}`);
        data.methodRoutes.set(name, path);
    }) as DualClassDecorator & SimpleMemberDecorator;
}
