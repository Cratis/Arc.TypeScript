// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Node WebSocket bridge contract without a dependency on the ws declaration package. */
export interface NodeWebSocketLike {
    readonly readyState: number;
    readonly bufferedAmount: number;
    on(event: 'message', listener: (data: { toString(): string }, binary: boolean) => void): unknown;
    on(event: 'close' | 'error', listener: () => void): unknown;
    send(data: string, callback: (error?: Error) => void): void;
    close(code?: number, reason?: string): void;
    terminate(): void;
}
