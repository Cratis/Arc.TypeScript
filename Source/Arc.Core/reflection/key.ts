// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fieldOption } from './fieldOption.js';

/** @experimental Reserved for storage integrations; has no effect on the current wire pipeline. */
export function key(): ReturnType<typeof fieldOption> { return fieldOption({}); }
