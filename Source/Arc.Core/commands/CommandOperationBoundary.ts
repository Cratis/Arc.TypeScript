// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
const active = new AsyncLocalStorage<{ attempts: number }>();
/** Reject same-host nested commands inside an operation even if the failed result is ignored. */
export class CommandOperationBoundary {
    static attempt(): boolean {
        const frame = active.getStore();
        if (!frame) return false;
        frame.attempts++;
        return true;
    }
    static async run<T>(callback: () => Promise<T>): Promise<T> {
        const frame = { attempts: 0 };
        const value = await active.run(frame, callback);
        if (frame.attempts) throw new Error('Nested commands are unsupported in command operations');
        return value;
    }
}
