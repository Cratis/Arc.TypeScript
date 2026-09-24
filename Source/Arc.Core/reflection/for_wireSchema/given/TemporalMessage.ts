// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { DateOnly, field, TimeOnly, TimeSpan } from '@cratis/fundamentals';
/** Every supported temporal wire field type in one model. */
export class TemporalMessage {
    @field(Date) occurred!: Date;
    @field(DateOnly) date!: DateOnly;
    @field(TimeOnly) time!: TimeOnly;
    @field(TimeSpan) duration!: TimeSpan;
}
