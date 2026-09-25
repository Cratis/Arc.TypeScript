// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { CommandOperation } from '../../commands/CommandOperation.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import { tuple } from '../../commands/tuple.js';
import type { ExecutionContext } from '../../execution/ExecutionContext.js';

export class a_command_with_invalid_client_output {
    readonly events: string[] = [];
    readonly context: ExecutionContext = { correlationId: 'output', allowedSeverity: 2,
        signal: new AbortController().signal, principal: undefined, tenantId: undefined };
    readonly server: ArcServer;
    constructor() {
        const events = this.events;
        class Probe extends CommandOperation {
            execute(signal: AbortSignal): void { void signal; events.push('execute'); }
            compensate(failure: unknown, signal: AbortSignal): void {
                void failure; void signal;
                events.push('compensate');
            }
        }
        this.server = new ArcServer({ commands: [defineCommand({ name: 'Run', schema: z.object({}),
            clientOutput: { output: { kind: 'number' } },
            handle: () => tuple('not a number', new Probe()),
            scopes: [() => ({ isCommitParticipant: true, getCommitDisposition: () => 'NoCommit' as const,
                begin: () => { events.push('begin'); },
                complete: (context: unknown, result: CommandResult) => {
                    void context; void result;
                    events.push('complete');
                } })]
        })] });
    }
}
