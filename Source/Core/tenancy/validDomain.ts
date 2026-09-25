// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { tenantLabel } from './tenantId.js';

/** Accept a tenant domain, but never an IPv4 address. */
export function validDomain(host: string): boolean {
    const labels = host.split('.');
    const ipv4 = labels.length === 4 && labels.every(part => /^(?:0|[1-9][0-9]{0,2})$/.test(part) && Number(part) <= 255);
    return host.length <= 253 && !ipv4 && labels.length >= 2 && labels.every(part => tenantLabel.test(part));
}
