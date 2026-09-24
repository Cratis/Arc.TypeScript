// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';

/** Fixture for the .NET acronym naming and non-finite number wire rules. */
export class HttpMetric {
    @field(Number) HTTPCount!: number;
    @field(Number) RecordedValue!: number;
}
