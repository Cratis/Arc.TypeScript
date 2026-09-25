// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Constructor } from '@cratis/fundamentals';
import type { ChronicleReadModels } from '@cratis/arc.chronicle';
import { Observable } from 'rxjs';
import type { Subscription } from 'rxjs';

/** Combine the projected snapshot and subsequent changes into a live list. */
export function observeProjected<T extends object>(models: ChronicleReadModels, type: Constructor<T>,
    key: (item: T) => string, filter: (item: T) => boolean = () => true): Observable<T[]> {
    return new Observable<T[]>(subscriber => {
        let stopped = false;
        let observation: Subscription | undefined;
        void (async () => {
            const current = new Map((await (await models.getStore()).readModels.getInstances(type))
                .map(item => [key(item), item]));
            if (stopped) return;
            const emit = () => subscriber.next([...current.values()].filter(filter));
            emit();
            observation = models.watch(type).subscribe({
                next: change => {
                    if (change.removed) current.delete(change.key);
                    else current.set(change.key, change.readModel);
                    emit();
                },
                error: error => subscriber.error(error)
            });
        })().catch(error => subscriber.error(error));
        return () => { stopped = true; observation?.unsubscribe(); };
    });
}
