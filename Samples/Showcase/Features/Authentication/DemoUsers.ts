// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Principal } from '@cratis/arc.core';

/** The cookie that carries the signed-in demo user. It is a demonstration, never a credential. */
export const userCookie = 'showcase-user';

/** Synthetic users the toolbar can sign in as. */
export const demoUsers: Readonly<Record<string, Principal>> = {
    ada: { id: 'ada', name: 'Ada (admin)', roles: ['Admin'], isAuthenticated: true },
    grace: { id: 'grace', name: 'Grace (reader)', roles: ['Reader'], isAuthenticated: true }
};

/** Read one cookie from a raw Cookie header. */
export function cookieValue(header: string | undefined, name: string): string | undefined {
    return header?.split(';').map(part => part.trim().split('='))
        .find(([cookie]) => cookie === name)?.[1];
}

/** The demo principal for a Cookie header, or undefined for an anonymous caller. */
export function principalFromCookies(header: string | undefined): Principal | undefined {
    const user = cookieValue(header, userCookie);
    return user ? demoUsers[user] : undefined;
}
