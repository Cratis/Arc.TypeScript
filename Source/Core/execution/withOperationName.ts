// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Stamp the compiled declaration identity on a mutable operation context without letting filters replace it. */
export function withOperationName<T extends object>(context: T, operationName: string): T & { readonly operationName: string } {
    Object.defineProperty(context, 'operationName', { value: operationName, writable: false, configurable: false, enumerable: true });
    return context as T & { readonly operationName: string };
}
