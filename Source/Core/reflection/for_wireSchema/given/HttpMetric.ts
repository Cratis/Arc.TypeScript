// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { fieldOption } from '../../fieldOption.js';

/** Fixture for the .NET acronym naming and non-finite number wire rules. */
export class HttpMetric {
    @fieldOption({ namedFloats: true }) @field(Number) HTTPCount!: number;
    @fieldOption({ namedFloats: true }) @field(Number) RecordedValue!: number;
}
