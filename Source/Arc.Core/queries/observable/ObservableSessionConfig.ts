// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ExecutionContext } from '../../execution/ExecutionContext.js';
import type { QueryOptions } from '../QueryOptions.js';
import type { ServiceRegistry } from '../../dependencyInjection/ServiceRegistry.js';
import type { ServiceToken } from '../../dependencyInjection/ServiceToken.js';
import type { ObservableEmissionGuard } from './ObservableEmissionGuard.js';
import type { ObservableOperation } from './ObservableOperation.js';

/** Internal ownership and failure reporting supplied when opening one subscription. */
export interface ObservableSessionConfig {
    readonly operation: ObservableOperation;
    readonly input: unknown;
    readonly options?: QueryOptions;
    readonly services: ServiceRegistry;
    readonly guards: readonly ServiceToken<ObservableEmissionGuard>[];
    readonly development: boolean;
    readonly pendingEmissions: number;
    readonly context: ExecutionContext;
    readonly reportFailure: (error: unknown) => Promise<void>;
    readonly onRelease: () => void;
    readonly onClose: () => void;
}
