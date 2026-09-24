// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field, Guid } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';
export class TaskRecord {
    @field(Guid) @key() id!: Guid;
    @field(String) title!: string;
}
