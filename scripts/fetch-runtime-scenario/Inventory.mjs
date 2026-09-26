// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { readModel, query, CurrentValueSubject, currentContext } from '@cratis/arc.core/fetch';

/** Snapshot and observable methods exercised on every Fetch host check. */
let activeStreams = 0;

export class Inventory {
    static All() { return ['ready']; }
    static Live() {
        const values = CurrentValueSubject.of(['ready']);
        return {
            current: () => values.current(),
            subscribe(observer) {
                activeStreams++;
                const subscription = values.subscribe(observer);
                return { unsubscribe() { activeStreams--; subscription.unsubscribe(); } };
            }
        };
    }
    static ActiveStreams() { return { count: activeStreams }; }
    static Tenant() { return currentContext()?.tenantId; }
}
readModel()(Inventory);
query()(Inventory, 'All');
query()(Inventory, 'ActiveStreams');
query()(Inventory, 'Tenant');
query({ observable: true })(Inventory, 'Live');
