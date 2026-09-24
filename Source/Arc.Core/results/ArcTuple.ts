// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

const tupleBrand: unique symbol = Symbol.for('@cratis/arc.core/tuple');
/** Branded group of response values, distinct from an ordinary array. */
export class ArcTuple<Values extends readonly unknown[]> {
    readonly [tupleBrand] = true;
    constructor(readonly values: Values) {}
}
/** Recognize tuple values even across duplicate package copies. */
export function isArcTuple(value: unknown): value is ArcTuple<readonly unknown[]> {
    return !!value && typeof value === 'object' && Reflect.get(value, tupleBrand) === true &&
        Array.isArray(Reflect.get(value, 'values'));
}
