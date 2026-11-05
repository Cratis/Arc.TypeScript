// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext, Principal } from '@cratis/arc.core';
import { ShowcaseIdentity } from '../../Identity.js';

export class a_signed_in_user {
    provider = new ShowcaseIdentity();
    principal: Principal = { id: 'ada', name: 'Ada (admin)', roles: ['Admin'], isAuthenticated: true };
    context = { tenantId: 'acme' } as ExecutionContext;
}
