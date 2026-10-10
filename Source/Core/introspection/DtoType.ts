// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClientType } from './ClientType.js';

/** The DTO member of the client wire type union. */
export type DtoType = Extract<ClientType, { kind: 'dto' }>;
