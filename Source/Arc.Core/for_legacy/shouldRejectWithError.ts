// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';

should();

export async function shouldRejectWithError(promise: Promise<unknown>, message?: string | RegExp): Promise<void> {
    let rejected = false;
    let reason: unknown;
    try {
        await promise;
    } catch (error) {
        rejected = true;
        reason = error;
    }
    rejected.should.equal(true);
    (reason instanceof Error).should.equal(true);
    if (typeof message === 'string') (reason as Error).message.should.contain(message);
    if (message instanceof RegExp) (reason as Error).message.should.match(message);
}
