// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ClientField } from './ClientField.js';
import type { ClientType } from './ClientType.js';
export interface ClientOperation {
    id: string;
    kind: 'command' | 'query';
    route: string;
    methods: readonly string[];
    queryName?: string;
    roles: readonly string[];
    authentication: 'anonymous' | 'authenticated' | 'default';
    dynamicAuthorization: boolean;
    input: readonly ClientField[];
    output: ClientType;
}
