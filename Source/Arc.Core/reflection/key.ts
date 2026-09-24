// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fieldOption } from './fieldOption.js';

/** Mark the read-model identity for storage integrations; HTTP wire names remain unchanged. */
export function key(): ReturnType<typeof fieldOption> { return fieldOption({ key: true }); }
