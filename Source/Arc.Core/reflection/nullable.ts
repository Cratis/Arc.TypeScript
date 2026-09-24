// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fieldOption } from './fieldOption.js';

/** Allow a decorated field to contain null. */
export function nullable(): ReturnType<typeof fieldOption> { return fieldOption({ nullable: true }); }
