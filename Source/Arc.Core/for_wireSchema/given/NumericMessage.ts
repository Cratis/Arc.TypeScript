// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { enumeration } from '../../modelBound/index.js';
import { NumericPriority } from './NumericPriority.js';

/** A message with numeric enum wire values. */
export class NumericMessage {
    @enumeration(NumericPriority)
    @field(Number) priority!: NumericPriority;
}
