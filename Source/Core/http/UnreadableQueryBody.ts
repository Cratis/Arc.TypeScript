// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { BadRequest } from './BadRequest.js';

/** A QUERY request body whose JSON or declared envelope shape cannot be read. */
export class UnreadableQueryBody extends BadRequest {
    constructor() { super('The QUERY request body could not be read'); this.name = 'UnreadableQueryBody'; }
}
