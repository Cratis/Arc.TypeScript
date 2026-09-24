// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClassType } from './ClassType.js';
/** A class constructor that may declare a concept's primitive value type. */
export type WireType = ClassType & { valueType?: WireType };
