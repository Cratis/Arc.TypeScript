// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ServiceIdentifier } from '../../dependencyInjection/ServiceIdentifier.js';
/** Service resolved for a model-bound query invocation. */
export interface ParameterService {
    readonly kind: 'service';
    readonly token: ServiceIdentifier<unknown>;
    readonly optional?: boolean;
}
