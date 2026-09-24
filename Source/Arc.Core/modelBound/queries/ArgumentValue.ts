// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Value } from '../reflection/Value.js';
import type { ParameterArgument } from './ParameterArgument.js';
/** Infer a scalar or array query argument from its runtime descriptor. */
export type ArgumentValue<T extends ParameterArgument> = T extends { readonly element: infer Element } ?
    Value<Element>[] : Value<T['type']>;
