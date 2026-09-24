// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';

/** Query projection used to verify scoped interception before wire encoding. */
export class Task {
    @field(String) name!: string;
    constructor(name?: string) { if (name !== undefined) this.name = name; }
}
