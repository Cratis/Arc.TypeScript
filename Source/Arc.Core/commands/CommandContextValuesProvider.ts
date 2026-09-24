// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** Supplies values once per command; later providers overwrite names case-insensitively. */
export interface CommandContextValuesProvider {
    provide(command: unknown): ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>> | Promise<ReadonlyMap<string, unknown> | Readonly<Record<string, unknown>>>;
}
