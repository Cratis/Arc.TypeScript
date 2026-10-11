// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Throw the standard client manifest validation error. */
export function fail(location: string, detail: string): never { throw new Error(`Client manifest ${location}: ${detail}`); }

/** Whether the value is a plain object with the default prototype. */
export const plain = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

/** Whether every own key of the object is one of the allowed keys. */
export const hasOnlyKeys = (value: object, allowed: readonly string[]): boolean => Object.keys(value).every(key => allowed.includes(key));

/** Ordinal string comparison used for deterministic manifest ordering. */
export const compareOrdinal = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** Whether a Zod definition carries any checks. */
export const hasChecks = (definition: object): boolean => 'checks' in definition && Array.isArray(definition.checks) && definition.checks.length > 0;
