// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from './ClassType.js';
/** Shared class decorator signature for legacy and standard transforms. */
export type DualClassDecorator = (target: ClassType, context?: ClassDecoratorContext) => void;
