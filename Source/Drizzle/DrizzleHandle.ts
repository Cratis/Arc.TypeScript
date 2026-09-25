// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { DrizzleDatabase } from './DrizzleDatabase.js';

/** Scoped reference to an application-owned connection or pool; Arc never disposes the native database. */
export class DrizzleHandle<T extends DrizzleDatabase = DrizzleDatabase> {
    constructor(readonly native: T) {}
}
