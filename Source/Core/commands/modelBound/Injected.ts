// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceClass, ServiceIdentifier } from '../../dependencyInjection/ServiceIdentifier.js';
import type { ServiceToken } from '../../dependencyInjection/ServiceToken.js';
/** Infer ordered command method arguments from injected service tokens. */
export type Injected<T extends readonly ServiceIdentifier<unknown>[]> = {
    -readonly [Index in keyof T]: T[Index] extends ServiceClass<infer Instance> ? Instance :
        T[Index] extends ServiceToken<infer Instance> ? Instance : never
};
