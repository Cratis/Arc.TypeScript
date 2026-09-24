// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** A named authorization policy or scheme cannot be resolved. */
export class InvalidAuthorizationConfiguration extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'InvalidAuthorizationConfiguration';
    }
}
