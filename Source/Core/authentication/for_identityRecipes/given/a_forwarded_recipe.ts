// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { microsoftIdentityClaims, microsoftIdentityPlatform } from '../../microsoftIdentityPlatform.js';
import { an_identity_recipe } from './an_identity_recipe.js';

export class a_forwarded_recipe extends an_identity_recipe {
    readonly objectId = '44444444-4444-4444-8444-444444444444';
    readonly tenant = '11111111-1111-4111-8111-111111111111';

    setup(): void { this.configure(microsoftIdentityPlatform()); }

    headers(identityProvider = 'aad'): Record<string, string> {
        return this.encode({ identityProvider, userId: 'ignored-payload-id', userDetails: 'Alice', userRoles: ['Reader'], claims: [
            { typ: 'sub', val: 'forged-subject' },
            { typ: microsoftIdentityClaims.nameIdentifier, val: 'forged-identifier' },
            { typ: microsoftIdentityClaims.provider, val: 'forged-provider' },
            { typ: microsoftIdentityClaims.provider.toUpperCase(), val: 'forged-provider-case' },
            { typ: microsoftIdentityClaims.name, val: 'ignored-claim-name' },
            { typ: microsoftIdentityClaims.role, val: 'Reports.Read' },
            { typ: 'http://schemas.microsoft.com/identity/claims/objectidentifier', val: this.objectId },
            { typ: 'http://schemas.microsoft.com/identity/claims/tenantid', val: this.tenant },
            { typ: 'SUB', val: 'case-sensitive-extension' }
        ] });
    }

    encode(payload: unknown): Record<string, string> {
        return { 'x-ms-client-principal-id': 'forwarded-alice', 'x-ms-client-principal-name': 'Ignored header name',
            'x-ms-client-principal-idp': 'ignored-header-provider',
            'x-ms-client-principal': Buffer.from(JSON.stringify(payload)).toString('base64') };
    }
}
