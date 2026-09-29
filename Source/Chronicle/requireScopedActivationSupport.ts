// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ChronicleOptions } from '@cratis/chronicle';
// Namespace import: probing for an export must not make the module fail to link on SDKs below the capability.
import * as chronicleArtifacts from '@cratis/chronicle/artifacts';
import type { ClientArtifactsActivator } from '@cratis/chronicle/artifacts';

/** The lowest @cratis/chronicle version whose client honors scoped activation fully. */
export const scopedActivationMinimumSdk = '6.17.0';

/** The parts of the installed SDK that decide whether scoped activation can be honored. */
export interface ScopedActivationSdk {
    readonly options: Pick<typeof ChronicleOptions, 'fromConnectionString'>;
    readonly artifacts: object;
}

const installed: ScopedActivationSdk = { options: ChronicleOptions, artifacts: chronicleArtifacts };

/**
 * Fail fast when the installed SDK cannot honor scoped activation. Below 6.16 the client ignores the activator and
 * constructs artifacts without Arc; 6.16 neither completes leases nor passes invocation metadata, so correlation and
 * cleanup failures would silently degrade. Completion failures (ArtifactCompletionFailed) arrive with 6.17.
 * @param connectionString - The Arc-owned connection string; parsing it does not connect.
 * @param activator - The activator that must reach the client options.
 * @param sdk - The SDK surface to check; defaults to the installed SDK.
 */
export function requireScopedActivationSupport(connectionString: string, activator: ClientArtifactsActivator,
    sdk: ScopedActivationSdk = installed): void {
    const honored = sdk.options.fromConnectionString(connectionString, { artifactActivator: activator }).artifactActivator === activator;
    if (!honored || !('ArtifactCompletionFailed' in sdk.artifacts))
        throw new Error(`activateArtifactsInScopes requires @cratis/chronicle ${scopedActivationMinimumSdk} or later`);
}
