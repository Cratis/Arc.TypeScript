// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClientField } from './ClientField.js';
/** Explicit wire shape. No TypeScript return-type inference or runtime constructor inference is performed. */
export type ClientType =
    | { kind: 'void' }
    | { kind: 'string' }
    | { kind: 'boolean' }
    | { kind: 'number' }
    | { kind: 'enum'; values: readonly string[] }
    | { kind: 'array'; element: Exclude<ClientType, { kind: 'void' }> }
    | { kind: 'dto'; name: string; fields: readonly ClientField[] };
