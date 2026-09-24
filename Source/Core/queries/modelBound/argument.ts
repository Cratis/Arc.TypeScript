// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { WireType } from '../../reflection/WireType.js';
import type { ParameterArgument } from './ParameterArgument.js';

/** Bind a named query argument with its runtime wire type. */
export function argument<T extends WireType>(name: string, type: T): ParameterArgument & { readonly optional: false; readonly type: T };
export function argument<T extends WireType>(name: string, type: T,
    options: { optional: true }): ParameterArgument & { readonly optional: true; readonly type: T };
export function argument<T extends WireType, Element extends WireType>(name: string, type: T,
    options: { elementType: Element; optional?: false }): ParameterArgument & {
        readonly optional: false; readonly type: T; readonly element: Element
    };
export function argument<T extends WireType, Element extends WireType>(name: string, type: T,
    options: { elementType: Element; optional: true }): ParameterArgument & {
        readonly optional: true; readonly type: T; readonly element: Element
    };
export function argument(name: string, type: WireType, options: { optional?: boolean; elementType?: WireType } = {}): ParameterArgument {
    if (!name.trim()) throw new Error('Query argument name is required');
    return { kind: 'argument', name, type, optional: options.optional === true, element: options.elementType };
}
