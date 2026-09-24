// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from '../../reflection/ClassType.js';
import type { Parameter } from './Parameter.js';
/** Compiled declarations for one static model-bound query. */
export interface QueryMetadata {
    readonly parameters?: readonly Parameter[];
    readonly observable: boolean;
    readonly argumentsModel?: ClassType;
}
