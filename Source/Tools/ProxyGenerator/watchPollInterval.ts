// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Resolve the fallback scan interval without overflowing Node's signed 32-bit timer delay. */
export function watchPollInterval(value?: number, platform = process.platform): number {
    const interval = value ?? (platform === 'darwin' ? 1000 : 5000);
    if (!Number.isInteger(interval) || interval < 0 || interval > 2_147_483_647)
        throw new Error('Watch poll interval must be an integer from 0 to 2147483647 milliseconds');
    return interval;
}
