// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceClass, ServiceIdentifier } from './ServiceIdentifier.js';
import type { ServiceToken } from './ServiceToken.js';
import type { ParameterService } from '../queries/modelBound/ParameterService.js';

/** Resolve a service token in a query's execution scope. */
export function service<T extends ServiceClass<unknown>>(token: T): ParameterService & { readonly token: T };
export function service<T>(token: ServiceToken<T>): ParameterService & { readonly token: ServiceToken<T> };
export function service<T>(token: ServiceIdentifier<T>): ParameterService { return { kind: 'service', token }; }
