// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Current value is explicit: undefined may itself be a present value. */
export type CurrentValue<T> = { readonly hasValue: false } | { readonly hasValue: true; readonly value: T };
