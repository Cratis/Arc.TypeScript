// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';

/** Base wire type for a generated-client round trip. */
export class BaseNotice {
    @field(String) title!: string;
}
