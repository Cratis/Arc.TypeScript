// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, nullable } from '@cratis/arc.core';
import { Priority } from './Priority.js';

@command()
export class RecordTask {
    @field(Number) priority!: Priority;
    @field(String) @nullable() note!: string | null;
    @field(String) nickname?: string;
    @field(Number) count = 2;
    handle(): void {}
}
