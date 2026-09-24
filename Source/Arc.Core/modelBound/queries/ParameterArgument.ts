// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { WireType } from '../reflection/WireType.js';
/** Named query argument and its decoded wire type. */
export interface ParameterArgument {
    readonly kind: 'argument';
    readonly name: string;
    readonly type: WireType;
    readonly optional: boolean;
    readonly element?: WireType;
}
