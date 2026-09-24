// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
export class Policy {
    constructor(readonly accepts: (value: string, signal: AbortSignal) => Promise<boolean>) {}
}
