// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Authorization } from './Authorization.js';
import { setClassAuthorization } from './setClassAuthorization.js';
import { setMemberAuthorization } from './setMemberAuthorization.js';
import type { ClassType } from '../reflection/ClassType.js';
import type { DualClassDecorator } from '../reflection/DualClassDecorator.js';
import type { SimpleMemberDecorator } from '../reflection/SimpleMemberDecorator.js';

/** Apply an authorization requirement to a class or method. */
export function authorizationDecorator(value: Authorization): DualClassDecorator & SimpleMemberDecorator {
    return ((target: object, nameOrContext?: string | symbol | ClassMethodDecoratorContext | ClassDecoratorContext) => {
        if (nameOrContext === undefined || typeof nameOrContext === 'object' && nameOrContext.kind === 'class') {
            setClassAuthorization(target as ClassType, value);
            return;
        }
        const standard = typeof nameOrContext === 'object';
        const name = standard ? nameOrContext.name : nameOrContext;
        if (typeof name !== 'string') throw new Error('Authorization requires a named declaration');
        setMemberAuthorization(target, name, value, standard ? nameOrContext : undefined);
    }) as DualClassDecorator & SimpleMemberDecorator;
}
