// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { key } from '@cratis/arc.core';

export class RelatedRecord {
    @field(String) @key() id!: string;
    @field(String) name!: string;
}
