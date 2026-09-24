// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { WireType } from './WireType.js';
import type { FieldOptions } from './FieldOptions.js';
/** Reflected wire field and its optional collection element and annotations. */
export interface WireField {
    readonly name: string;
    readonly type: WireType;
    readonly element?: WireType;
    readonly options: FieldOptions;
}
