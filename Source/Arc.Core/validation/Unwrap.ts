// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Primitive value supplied to rules for a concept member.
 * The structural shape keeps emitted types usable without a second Fundamentals copy.
 */
export type Unwrap<V> = V extends { readonly value: infer Primitive; valueOf(): unknown } ? Primitive : V;
