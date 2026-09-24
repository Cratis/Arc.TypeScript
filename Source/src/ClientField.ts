// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClientType } from './ClientType.js';
/** Omission is distinct from null; generated commands cannot serialize explicit null. */
export interface ClientField {
    name: string;
    type: Exclude<ClientType, { kind: 'void' }>;
    optional?: boolean;
}
