// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readModel, query, CurrentValueSubject, currentContext } from '@cratis/arc.core/fetch';

/** Snapshot and observable methods exercised on every Fetch host check. */
export class Inventory {
    static All() { return ['ready']; }
    static Live() { return CurrentValueSubject.of(['ready']); }
    static Tenant() { return currentContext()?.tenantId; }
}
readModel()(Inventory);
query()(Inventory, 'All');
query()(Inventory, 'Tenant');
query({ observable: true })(Inventory, 'Live');
