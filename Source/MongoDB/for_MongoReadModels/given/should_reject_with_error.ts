// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
export const capture_error = (promise: Promise<unknown>): Promise<unknown> => promise.then(() => undefined, error => error as unknown);

export function should_reject_with_error(error: unknown, message: string): void {
    (error instanceof Error).should.equal(true);
    (error as Error).message.should.contain(message);
}
