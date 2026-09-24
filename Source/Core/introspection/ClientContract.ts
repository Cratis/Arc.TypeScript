// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClientType } from './ClientType.js';
/** Explicit output metadata; required only for manifest export, never for existing handlers. */
export interface ClientContract { output: ClientType }
