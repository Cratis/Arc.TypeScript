// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ClientAuthentication } from './ClientAuthentication.js';
import { ClientOperationKind } from './ClientOperationKind.js';
import type { ClientField } from './ClientField.js';
import type { ClientType } from './ClientType.js';
export interface ClientOperation {
    id: string;
    kind: ClientOperationKind;
    route: string;
    methods: readonly string[];
    queryName?: string;
    roles: readonly string[];
    authentication: ClientAuthentication;
    dynamicAuthorization: boolean;
    input: readonly ClientField[];
    output: ClientType;
}
