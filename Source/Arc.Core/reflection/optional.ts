// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fieldOption } from './fieldOption.js';

/** Make a decorated field optional on input. */
export function optional(): ReturnType<typeof fieldOption> { return fieldOption({ optional: true }); }
