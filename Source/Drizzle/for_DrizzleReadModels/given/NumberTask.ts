// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';

/** Read model with a plain integer primary key. */
export class NumberTask {
    @field(Number) id!: number;
    @field(String) title!: string;
}
