// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Join a declared namespace and operation name without adding a leading dot. */
export function fullyQualifiedName(item: { readonly namespace?: string; readonly name: string }): string {
    return [item.namespace, item.name].filter(Boolean).join('.');
}
