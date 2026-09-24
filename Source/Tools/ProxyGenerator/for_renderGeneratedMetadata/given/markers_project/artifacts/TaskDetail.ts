// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { readModel } from '@cratis/arc.core';

@readModel()
export class TaskDetail {
    @field(String) id!: string;
}
