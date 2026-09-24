// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from './ClassType.js';

/** Source-declared result shape, available before the first execution. */
export interface GeneratedReturn {
    readonly cardinality: 'one' | 'many' | 'paged' | 'void';
    readonly nullable: boolean;
    readonly element?: ClassType | StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor;
}
