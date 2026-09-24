// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
/** An application-defined rule for resolving a command's identity. */
export interface CommandKeyResolver {
    resolve(command: unknown): string | undefined;
}
/** A command may compose its own key rather than marking a field. */
export interface CanProvideKeyForCommand {
    getKey(): string | undefined;
}
