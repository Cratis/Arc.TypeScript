// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from '../modelBound/metadata.js';
import { metadataFor, ownMetadata } from '../modelBound/metadata.js';
import { BaseValidator } from './BaseValidator.js';

export function validator<T>(target: ClassType<T>): <V extends ClassType<BaseValidator<T>>>(type: V, context?: ClassDecoratorContext<V>) => void {
    return type => {
        if (!(type.prototype instanceof BaseValidator)) throw new Error(`Validator ${type.name} must extend BaseValidator`);
        metadataFor(type).validatorTarget = target;
    };
}
export function validatorTarget(type: ClassType): ClassType | undefined { return ownMetadata(type).validatorTarget; }
