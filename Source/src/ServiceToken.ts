// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** An identity-based key for a service; names are diagnostic only. */
export interface ServiceToken<T> {
    readonly key: symbol;
    readonly name: string;
    /** Phantom member for inferred resolution types. */
    readonly service?: T;
}
export function serviceToken<T>(name: string): ServiceToken<T> {
    if (!name.trim()) throw new Error('Service token name is required');
    return Object.freeze({ key: Symbol(name), name });
}
