// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { CommandContext, CommandOperationExecutionScope, CommandResult } from '@cratis/arc.core';
import { CommandCommitDisposition, currentServices } from '@cratis/arc.core';
import { ChronicleUnitOfWork } from './ChronicleUnitOfWork.js';
import { ChronicleResponseHandler } from './ChronicleResponseHandler.js';

/** Commit the returned-event batch before Arc decides whether operations need compensation. */
export class ChronicleCommandScope implements CommandOperationExecutionScope {
    get isCommitParticipant(): boolean { return this.#unit?.hasStagedEvents ?? false; }
    #unit?: ChronicleUnitOfWork;
    constructor(private readonly completionTimeoutMs?: number) {}
    begin(context: CommandContext): void {
        this.#unit = ChronicleUnitOfWork.active();
        if (!this.#unit) throw new Error('Chronicle command scope requires a running Chronicle command');
        if (context.tenantId !== this.#unit.context.tenantId || context.correlationId !== this.#unit.context.correlationId)
            throw new Error('Nested Chronicle commands must share tenant and correlation ID');
    }
    getCommitDisposition(context: CommandContext): CommandCommitDisposition {
        return this.#unit && (context === this.#unit.context || context.correlationId === this.#unit.context.correlationId)
            ? this.#unit.disposition === CommandCommitDisposition.NoCommit && this.#unit.hasStagedEvents
                ? CommandCommitDisposition.NotCommitted : this.#unit.disposition : CommandCommitDisposition.Unknown;
    }
    async complete(context: CommandContext, result: CommandResult): Promise<void> {
        if (this.#unit?.context !== context) return;
        if (result.isSuccess) {
            const aggregates = this.#unit.aggregates();
            if (aggregates.some(aggregate => aggregate.hasUnstagedEvents)) {
                const handler = await currentServices().resolve(ChronicleResponseHandler);
                for (const aggregate of aggregates) {
                    if (aggregate.hasUnstagedEvents) await handler.handle(context, aggregate.commit());
                }
            }
        }
        Object.assign(result, await this.#unit.commit(result, this.completionTimeoutMs));
    }
}
