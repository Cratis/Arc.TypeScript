// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Serializable subset of server Rule; produced by the validator analyzer when its model is available. */
export interface RecordedRule {
    readonly path: readonly string[];
    readonly kind: string;
    readonly args: readonly (string | number)[];
    readonly message?: string;
    readonly clientSafe: boolean;
}
