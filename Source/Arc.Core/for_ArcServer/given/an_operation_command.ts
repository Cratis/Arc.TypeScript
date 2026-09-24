// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { CommandOperation } from '../../commands/CommandOperationDeclaration.js';
import type { CommandCommitDisposition } from '../../commands/CommandCommitDisposition.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { tuple } from '../../results/tuple.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';

export class ProbeOperation extends CommandOperation {
    constructor(readonly name: string, readonly events: string[], readonly fail = false) { super(); }
    execute(signal: AbortSignal): void {
        void signal;
        this.events.push(`execute ${this.name}`);
        if (this.fail) throw new Error(`failed ${this.name}`);
    }
    compensate(failure: unknown, signal: AbortSignal): void { void failure; void signal; this.events.push(`compensate ${this.name}`); }
}

export class an_operation_command {
    readonly events: string[] = [];
    readonly command: { key: string } = { key: 'alpha' };
    readonly context: ExecutionContext = { correlationId: 'probe', allowedSeverity: 2,
        signal: new AbortController().signal, principal: undefined, tenantId: undefined };
    readonly server: ArcServer;
    value: unknown;
    disposition: CommandCommitDisposition = 'NoCommit';
    afterCompletion?: CommandCommitDisposition;
    eraseFailure = false;
    seen?: CommandContext;
    constructor() {
        this.server = new ArcServer({
            commands: [defineCommand({ name: 'Run', schema: z.object({ key: z.string() }),
                handle: (_input, context) => { this.seen = context as CommandContext; return this.value; },
                scopes: [() => ({ isCommitParticipant: true, getCommitDisposition: () => this.disposition,
                    begin: () => { this.events.push('begin'); },
                    complete: (execution: unknown, result: CommandResult) => {
                        void execution;
                        this.events.push('complete');
                        if (this.afterCompletion) this.disposition = this.afterCompletion;
                        if (this.eraseFailure) { result.exceptionMessages = []; result.isSuccess = true; }
                    } })] })],
            commandResponseValueHandlers: [],
        });
    }
    twoOperations(): void { this.value = tuple('reply', new ProbeOperation('first', this.events), new ProbeOperation('second', this.events, true)); }
}
