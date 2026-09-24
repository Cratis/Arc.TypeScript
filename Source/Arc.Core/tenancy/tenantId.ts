// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { TenantRequestError } from './TenantRequestError.js';
export const tenantLabel = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function tenantId(value: string): string {
    const normalized = value.toLowerCase();
    if (!tenantLabel.test(normalized)) throw new TenantRequestError(400);
    return normalized;
}
