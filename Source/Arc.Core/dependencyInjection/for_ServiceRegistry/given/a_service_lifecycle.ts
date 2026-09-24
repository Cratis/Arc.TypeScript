// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Severity } from '../../../validation/Severity.js';

export const serviceContext = (tenantId: string) => ({ correlationId: crypto.randomUUID(), principal: undefined, tenantId,
    signal: new AbortController().signal, allowedSeverity: Severity.Warning });

export function gate(): { promise: Promise<void>; release: () => void } {
    let release!: () => void;
    const promise = new Promise<void>(resolve => { release = resolve; });
    return { promise, release };
}

export async function beforeDeadline<T>(work: Promise<T>, name: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([work, new Promise<never>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error(`${name} hung`)), 1000);
        })]);
    } finally { if (timer) clearTimeout(timer); }
}

export const captureFailure = (work: Promise<unknown>): Promise<unknown> => work.then(() => undefined, error => error as unknown);
