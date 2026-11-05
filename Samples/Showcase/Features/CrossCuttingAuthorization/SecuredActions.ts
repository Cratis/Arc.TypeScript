// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Demonstration-only record of the secured commands that ran. */
export class SecuredActions {
    runs = 0;
    lastRunAt: string | undefined;

    run(): void {
        this.runs++;
        this.lastRunAt = new Date().toISOString();
    }
}
