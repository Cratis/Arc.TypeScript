// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { serviceToken, type ServiceToken } from '../../dependencyInjection/ServiceToken.js';
import type { ClassType } from '../../reflection/ClassType.js';

const models = new WeakMap<object, { type: ClassType; optional: boolean }>();
/** Bind a handle() or provide() parameter to a read model with the command's key. */
export function commandReadModel<T>(type: ClassType<T>): ServiceToken<T>;
/** Allow an absent instance to be passed as null instead of rejecting the command. */
export function commandReadModel<T>(type: ClassType<T>, options: { optional: true }): ServiceToken<T | null>;
export function commandReadModel<T>(type: ClassType<T>, options?: { optional: true }): ServiceToken<T | null> {
    const token = serviceToken<T | null>(`read model ${type.name}`);
    models.set(token, { type, optional: options?.optional === true });
    return token;
}
/** Metadata for a read-model argument, absent for ordinary services. */
export function readModelArgument(token: unknown): { type: ClassType; optional: boolean } | undefined {
    return token && typeof token === 'object' ? models.get(token) : undefined;
}
