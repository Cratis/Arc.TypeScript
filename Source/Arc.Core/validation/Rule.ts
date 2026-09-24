// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Severity } from './Severity.js';
/** Immutable rule descriptor evaluated against a model graph. */
export interface Rule {
    readonly path: readonly string[];
    readonly kind: string;
    readonly args: readonly unknown[];
    readonly message?: string | ((value: unknown, model: unknown) => string);
    readonly severity: Severity;
    readonly state?: unknown | ((model: unknown) => unknown);
    readonly condition?: (model: unknown) => boolean | Promise<boolean>;
    readonly clientSafe: boolean;
}
