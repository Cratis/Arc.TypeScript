// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { AsyncLocalStorage } from 'node:async_hooks';
interface CommandFrame { host: object; parent?: CommandFrame; attempts: number; inOperation: boolean }
const active = new AsyncLocalStorage<CommandFrame>();
const nestedError = 'Nested commands are unsupported in command operations';
/** Track one command frame per run so operations never escape the owning command's recovery. */
export class CommandOperationBoundary {
    static attempt(host: object): boolean {
        const frame = active.getStore();
        if (!frame || frame.host !== host) return false;
        frame.attempts++;
        return frame.inOperation;
    }
    static command<T>(host: object, callback: () => Promise<T>): Promise<T> {
        return active.run({ host, parent: active.getStore(), attempts: 0, inOperation: false }, callback);
    }
    static validate(): void {
        const frame = active.getStore();
        if (frame && (frame.attempts || frame.parent?.host === frame.host))
            throw new Error('Command operations require a flat command boundary; nested execution was rejected before operations started');
    }
    static async run<T>(callback: () => Promise<T>): Promise<T> {
        const frame = active.getStore();
        if (!frame) throw new Error('Command operation requires a command frame');
        const before = frame.attempts;
        frame.inOperation = true;
        try {
            const value = await callback();
            if (frame.attempts !== before) throw new Error(nestedError);
            return value;
        } finally {
            frame.inOperation = false;
        }
    }
}
