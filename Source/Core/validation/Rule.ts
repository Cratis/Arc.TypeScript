// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Severity } from './Severity.js';
/** Immutable rule descriptor evaluated against a model graph. Not exported from the package root. */
export interface Rule {
    /** Selected member path. */
    readonly path: readonly string[];
    /** Evaluation operation. */
    readonly kind: string;
    /** Bound values or predicates. */
    readonly args: readonly unknown[];
    /** Optional failure message. */
    readonly message?: string | ((value: unknown, model: unknown) => string);
    /** Failure severity. */
    readonly severity: Severity;
    /** Optional failure state. */
    readonly state?: unknown | ((model: unknown) => unknown);
    /** Optional applicability condition. */
    readonly condition?: (model: unknown) => boolean | Promise<boolean>;
    /** Whether this descriptor could be interpreted on a client. */
    readonly clientSafe: boolean;
}
