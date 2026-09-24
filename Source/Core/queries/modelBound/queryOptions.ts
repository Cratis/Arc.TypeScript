// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ParameterOptions } from './ParameterOptions.js';
/** Receive Arc paging and sorting options in a model-bound static query method. */
export function queryOptions(): ParameterOptions { return { kind: 'options' }; }
