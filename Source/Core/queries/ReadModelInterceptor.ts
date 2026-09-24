// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from '../reflection/ClassType.js';

/** Scoped transformation for instances of one exact read-model type, before wire encoding. */
export interface ReadModelInterceptor<T extends object = object> {
    readonly model: ClassType<T>;
    intercept(model: T): T | Promise<T>;
}
