// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CurrentValueSubject } from '../../CurrentValueSubject.js';
import type { ObservableObserver } from '../../ObservableObserver.js';

export function trackedSource<T>(subject: CurrentValueSubject<T>): { subscribe(observer: ObservableObserver<T>): { unsubscribe(): void }; count(): number;
    opened(): Promise<void> } {
    let active = 0;
    let notify!: () => void;
    const ready = new Promise<void>(resolve => { notify = resolve; });
    return {
        count: () => active,
        opened: () => ready,
        subscribe(observer) {
            active++;
            const subscription = subject.subscribe(observer);
            notify();
            return { unsubscribe: () => { active--; subscription.unsubscribe(); } };
        }
    };
}
