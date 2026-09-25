// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { encodeWireValue, type ArcApplicationBuilder, type ExecutionContext, type Severity } from '@cratis/arc.core';
import type { ClassType } from './ScenarioType.js';
import { ScenarioHost } from './ScenarioHost.js';
import { wireRoundTrip } from './wireRoundTrip.js';
import { withCommandAssertions } from './withCommandAssertions.js';
import type { ScenarioCommandResult } from './ScenarioCommandResult.js';

/** Runs one decorated command through Arc's real authorization, validation and handler pipeline. */
export class CommandScenario<T extends object> {
    readonly #host: ScenarioHost;
    readonly #type: ClassType<T>;
    constructor(type: ClassType<T>, ...artifacts: ClassType[]) {
        this.#type = type;
        this.#host = new ScenarioHost([type, ...artifacts]);
    }
    /** Construct a scenario; pass validator types and other decorated artifacts as additional arguments. */
    static for<T extends object>(type: ClassType<T>, ...artifacts: ClassType[]): CommandScenario<T> {
        return new CommandScenario(type, ...artifacts);
    }
    /** Install an integration before the scenario builds its application. */
    extend(install: (builder: ArcApplicationBuilder) => void): this { this.#host.extend(install); return this; }
    /** Register services before the first execution. */
    get services() { return this.#host.services; }
    /** Default trusted request values, applied to every call. */
    get context() { return this.#host.context; }
    /** Set trusted principal, tenant, correlation ID or signal for pipeline calls. */
    withContext(values: Partial<ExecutionContext>): this { this.#host.withContext(values); return this; }
    /** Skip JSON stringify/parse while still encoding values into Arc's wire shape. */
    withSerializationRoundTrip(enabled: boolean): this { this.#host.withSerializationRoundTrip(enabled); return this; }
    /** Set the command validation severity threshold. */
    withAllowedValidationSeverity(severity: Severity): this { this.#host.withAllowedValidationSeverity(severity); return this; }

    /** Execute values or an instance; return the actual pipeline result with focused assertions. */
    async execute(command: T | Partial<T>): Promise<ScenarioCommandResult> { return this.run(command, 'execute'); }
    /** Run validation without invoking provide or handle. */
    async validate(command: T | Partial<T>): Promise<ScenarioCommandResult> { return this.run(command, 'validate'); }
    /** Dispose application-owned services. Safe to call more than once. */
    dispose(): Promise<void> { return this.#host.dispose(); }

    private async run(command: T | Partial<T>, action: 'execute' | 'validate'): Promise<ScenarioCommandResult> {
        const application = await this.#host.application();
        const instance = command instanceof this.#type ? command : Object.assign(Reflect.construct(this.#type, []) as T, command);
        const matches = application.server.commands.filter(item => item.name === this.#type.name);
        if (matches.length !== 1) throw new Error(`Ambiguous or unregistered Arc command: ${this.#type.name}`);
        const operation = matches[0]!;
        const input = this.#host.serializationRoundTrip ? wireRoundTrip(instance) : encodeWireValue(instance);
        const name = [operation.namespace, operation.name].filter(Boolean).join('.');
        const context = this.#host.execution();
        const result = action === 'validate' ? await application.server.validateCommand(name, input, context) :
            await application.server.executeCommand(name, input, context);
        if (this.#host.serializationRoundTrip && result.response !== undefined) result.response = wireRoundTrip(result.response);
        return withCommandAssertions(result);
    }
}
