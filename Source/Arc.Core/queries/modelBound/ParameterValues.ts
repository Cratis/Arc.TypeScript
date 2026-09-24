// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Parameter } from './Parameter.js';
import type { ParameterValue } from './ParameterValue.js';
/** Infer ordered query method arguments from descriptors. */
export type ParameterValues<T extends readonly Parameter[]> = {
    -readonly [Index in keyof T]: T[Index] extends Parameter ? ParameterValue<T[Index]> : never
};
