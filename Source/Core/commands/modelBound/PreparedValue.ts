// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Outcome } from '../Outcome.js';
/** Exclude short-circuit outcomes from the preparation value passed into handle. */
export type PreparedValue<T> = T extends Outcome<unknown> ?
    T extends { kind: 'response'; value: infer Value } ? Value : never : T;
