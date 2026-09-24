// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fieldOption } from './fieldOption.js';

/** Supply an input default for a decorated field. */
export function defaultValue(value: unknown): ReturnType<typeof fieldOption> { return fieldOption({ defaultValue: value }); }
