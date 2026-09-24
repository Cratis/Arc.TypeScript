// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export class TenantRequestError extends Error {
    constructor(readonly status: 400 | 403) { super('Invalid tenant request'); }
}
