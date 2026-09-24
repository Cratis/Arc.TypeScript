// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { isIP } from 'node:net';
import { tenantLabel } from './tenantId.js';

export function validDomain(host: string): boolean {
    return host.length <= 253 && isIP(host) === 0 && host.split('.').length >= 2 && host.split('.').every(part => tenantLabel.test(part));
}
