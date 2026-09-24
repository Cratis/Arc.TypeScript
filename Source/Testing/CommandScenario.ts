// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { encodeWireValue, type ExecutionContext } from '@cratis/arc.core';
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
    /** Register services before the first execution. */
    get services() { return this.#host.services; }
    /** Default trusted request values, applied to every call. */
    get context() { return this.#host.context; }
    /** Set trusted principal, tenant, correlation ID or signal for pipeline calls. */
    withContext(values: Partial<ExecutionContext>): this { this.#host.withContext(values); return this; }
    /** Disable the JSON serialization boundary for object-only checks. */
    withSerializationRoundTrip(enabled: boolean): this { this.#host.withSerializationRoundTrip(enabled); return this; }

    /** Execute values or an instance; return the actual pipeline result with focused assertions. */
    async execute(command: T | Partial<T>): Promise<ScenarioCommandResult> { return this.run(command, false); }
    /** Run validation without invoking provide or handle. */
    async validate(command: T | Partial<T>): Promise<ScenarioCommandResult> { return this.run(command, true); }
    /** Dispose application-owned services. Safe to call more than once. */
    dispose(): Promise<void> { return this.#host.dispose(); }

    private async run(command: T | Partial<T>, validateOnly: boolean): Promise<ScenarioCommandResult> {
        const application = await this.#host.application();
        const operation = application.server.commands.find(item => item.name === this.#type.name);
        if (!operation) throw new Error(`Unregistered Arc command: ${this.#type.name}`);
        const instance = command instanceof this.#type ? command : Object.assign(Reflect.construct(this.#type, []) as T, command);
        const input = this.#host.serializationRoundTrip ? wireRoundTrip(instance) : encodeWireValue(instance);
        const name = [operation.namespace, operation.name].filter(Boolean).join('.');
        return withCommandAssertions(await application.server.executeCommand(name, input, this.#host.execution(), validateOnly));
    }
}
