// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { allowAnonymous, authorize, query, readModel } from '@cratis/arc.core';

/** What an authentication query answered. */
@readModel()
export class AuthenticationQueryItem {
    @field(String) endpoint!: string;
    @field(String) message!: string;
    @field(String) servedAt!: string;

    @allowAnonymous()
    @query()
    static anonymous(): AuthenticationQueryItem {
        return { endpoint: 'anonymous', message: 'Anyone can read this', servedAt: new Date().toISOString() };
    }

    @authorize()
    @query()
    static authenticated(): AuthenticationQueryItem {
        return { endpoint: 'authenticated', message: 'Only a signed-in user can read this', servedAt: new Date().toISOString() };
    }
}
