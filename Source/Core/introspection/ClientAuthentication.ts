// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Authentication required by an exported client operation. */
export enum ClientAuthentication {
    /** Allow anonymous requests. */
    Anonymous = 'anonymous',
    /** Require an authenticated caller. */
    Authenticated = 'authenticated',
    /** Use the application's default authentication behavior. */
    Default = 'default'
}
