// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryScenario } from '@cratis/arc.testing';
import { AuthenticationQueryItem } from '../../Queries.js';
import { metadata } from '../../../../generatedMetadata.js';

type Item = { endpoint: string; message: string };

export class an_authentication_query {
    anonymous = QueryScenario.for<Item>(AuthenticationQueryItem, 'anonymous');
    authenticated = QueryScenario.for<Item>(AuthenticationQueryItem, 'authenticated');

    constructor() {
        for (const scenario of [this.anonymous, this.authenticated]) scenario.extend(builder => builder.useGeneratedMetadata(metadata));
    }

    signIn(): this {
        this.authenticated.withContext({ principal: { id: 'ada', roles: [], isAuthenticated: true } });
        return this;
    }
}
