// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceClass } from '../../dependencyInjection/ServiceIdentifier.js';
import type { ServiceToken } from '../../dependencyInjection/ServiceToken.js';
import type { Parameter } from './Parameter.js';
import type { ParameterArgument } from './ParameterArgument.js';
import type { ParameterService } from './ParameterService.js';
import type { ParameterOptions } from './ParameterOptions.js';
import type { QueryOptions } from '../QueryOptions.js';
import type { ArgumentValue } from './ArgumentValue.js';
/** Infer a query method argument, including optional wire arguments. */
export type ParameterValue<T extends Parameter> = T extends ParameterArgument ?
    T['optional'] extends true ? ArgumentValue<T> | undefined : ArgumentValue<T> :
    T extends ParameterOptions ? QueryOptions :
    T extends ParameterService ? T['token'] extends ServiceClass<infer Instance> ? Instance :
    T['token'] extends ServiceToken<infer Instance> ? Instance : never : never;
