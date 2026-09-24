// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { Name } from './Name.js';
export class Entry {
    @field(Name) name!: Name;
}
