// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { ChronicleOptions } from '@cratis/chronicle';
import type { ClientArtifactsActivator } from '@cratis/chronicle/artifacts';
import { requireScopedActivationSupport } from '../../requireScopedActivationSupport.js';
import type { ScopedActivationSdk } from '../../requireScopedActivationSupport.js';

/** Simulates the SDK shapes the peer range allows, without installing them. */
export class an_sdk {
    readonly activator = (() => undefined) as unknown as ClientArtifactsActivator;
    failure: Error | undefined;

    /** keepsActivator: 6.16 added the option; hasCompletion: 6.17 added ArtifactCompletionFailed. */
    sdk(keepsActivator: boolean, hasCompletion: boolean): ScopedActivationSdk {
        return {
            options: {
                fromConnectionString: (_: unknown, options?: { artifactActivator?: ClientArtifactsActivator }) =>
                    (keepsActivator ? { artifactActivator: options?.artifactActivator } : {}) as unknown as ChronicleOptions
            } as ScopedActivationSdk['options'],
            artifacts: hasCompletion ? { ArtifactCompletionFailed: class {} } : { DefaultClientArtifactsProvider: class {} }
        };
    }

    check(sdk: ScopedActivationSdk): void {
        this.failure = undefined;
        try { requireScopedActivationSupport('chronicle://localhost:35000', this.activator, sdk); }
        catch (error) { this.failure = error as Error; }
    }
}
