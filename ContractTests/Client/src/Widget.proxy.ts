// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import '@cratis/fundamentals/reflection';
import { field } from '@cratis/fundamentals';
export class Widget {
    @field(String) id!: string;
    @field(String) name!: string;
}
