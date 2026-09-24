// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { ArcApplication, Severity, type ExecutionContext } from '@cratis/arc.core';
import type { ClassType } from './ScenarioType.js';
import { ScenarioServices } from './ScenarioServices.js';

/** Shared lazy application, context and ownership boundary for model-bound scenarios. */
export class ScenarioHost {
    readonly services: ScenarioServices;
    readonly context: Partial<ExecutionContext> = {};
    serializationRoundTrip = true;
    #application?: Promise<ArcApplication>;
    #closed = false;
    #closing?: Promise<void>;

    constructor(private readonly artifacts: readonly ClassType[]) {
        this.services = new ScenarioServices(() => {
            this.assertOpen();
            if (this.#application) throw new Error('Register scenario services before the first pipeline call');
        });
    }

    /** Set caller identity and request values before executing. */
    withContext(values: Partial<ExecutionContext>): this {
        this.assertOpen();
        Object.assign(this.context, values);
        return this;
    }

    /** Match the normal wire boundary by default; opt out for direct object-only decisions. */
    withSerializationRoundTrip(enabled: boolean): this {
        this.assertOpen();
        this.serializationRoundTrip = enabled;
        return this;
    }

    /** Set the maximum severity accepted by command validation. Query calls always use Warning. */
    withAllowedValidationSeverity(severity: Severity): this {
        this.assertOpen();
        Object.assign(this.context, { allowedSeverity: severity });
        return this;
    }

    execution(signal?: AbortSignal): ExecutionContext {
        this.assertOpen();
        const context = { correlationId: randomUUID(), principal: undefined, tenantId: undefined,
            allowedSeverity: Severity.Warning, signal: new AbortController().signal, ...this.context };
        return signal ? { ...context, signal: AbortSignal.any([context.signal, signal]) } : context;
    }

    async application(): Promise<ArcApplication> {
        this.assertOpen();
        if (!this.#application) {
            const builder = ArcApplication.createBuilder();
            builder.add(...this.artifacts);
            this.services.install(builder.services);
            this.#application = builder.build();
        }
        return this.#application;
    }

    /** Dispose the owned application once, including an in-flight first build. */
    dispose(): Promise<void> {
        if (this.#closing) return this.#closing;
        this.#closed = true;
        this.#closing = (async () => {
            if (this.#application) {
                // A failed build owns no application to dispose; preserve its original error at the call site.
                const application = await this.#application.catch(() => undefined);
                if (application) await application.dispose();
            }
        })();
        return this.#closing;
    }

    private assertOpen(): void {
        if (this.#closed) throw new Error('Scenario is disposed');
    }
}
