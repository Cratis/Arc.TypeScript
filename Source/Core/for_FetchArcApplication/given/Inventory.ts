// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel } from '../../fetch.js';

/** A read model with a snapshot query for Fetch registration specs. */
@readModel()
export class Inventory {
    @query()
    static All(): string[] { return ['ready']; }
}
