// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** An upgrade must not hold an unauthenticated Node socket indefinitely. */
export class ObservableHandshakeTimeoutError extends Error {
    constructor() { super('Observable WebSocket handshake timed out'); }
}

/** Bound asynchronous host authentication before accepting a WebSocket upgrade. */
export async function withObservableHandshakeTimeout<T>(callback: () => Promise<T>, timeoutMs: number): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            callback(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new ObservableHandshakeTimeoutError()), timeoutMs);
            })
        ]);
    } finally { if (timer) clearTimeout(timer); }
}
