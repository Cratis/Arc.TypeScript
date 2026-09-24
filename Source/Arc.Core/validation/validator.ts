// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from '../modelBound/reflection/metadata.js';
import { metadataFor, ownMetadata } from '../modelBound/reflection/metadata.js';
import { BaseValidator } from './BaseValidator.js';

/** Associate a model-bound validator class with its exact model type. */
export function validator<T>(target: ClassType<T>): <V extends ClassType<BaseValidator<T>>>(type: V, context?: ClassDecoratorContext<V>) => void {
    return type => {
        if (!(type.prototype instanceof BaseValidator)) throw new Error(`Validator ${type.name} must extend BaseValidator`);
        metadataFor(type).validatorTarget = target;
    };
}
/** Read a decorated validator's target type. */
export function validatorTarget(type: ClassType): ClassType | undefined { return ownMetadata(type).validatorTarget; }
