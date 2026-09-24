// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceClass } from '../../dependencyInjection/ServiceIdentifier.js';
/** Map a runtime constructor token to its static TypeScript value. */
export type Value<T> = T extends StringConstructor ? string : T extends NumberConstructor ? number :
    T extends BooleanConstructor ? boolean : T extends ServiceClass<infer Instance> ? Instance : never;
