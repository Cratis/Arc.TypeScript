// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { randomUUID } from 'node:crypto';
import { ArcServer } from '../ArcServer.js';
import type { ArcServerOptions } from '../ArcServerOptions.js';
import type { CommandResult, ExecutionContext, QueryOptions, QueryResult } from '../contracts.js';
import { Severity } from '../Severity.js';
import type { ObservableQuerySession } from '../queries/observable/ObservableQuerySession.js';

/** Executes real Arc pipelines. Owns its server unless a caller supplied a registry. */
export class ArcScenario {
    readonly server: ArcServer;
    constructor(options: ArcServerOptions, readonly context: Partial<ExecutionContext> = {}) {
        this.server = new ArcServer(options);
    }
    private execution(overrides: Partial<ExecutionContext>): ExecutionContext {
        return { correlationId: randomUUID(), principal: undefined, tenantId: undefined,
            signal: new AbortController().signal, allowedSeverity: Severity.Warning, ...this.context, ...overrides };
    }
    executeCommand(name: string, input: unknown, context: Partial<ExecutionContext> = {}, validateOnly = false): Promise<CommandResult> {
        return this.server.executeCommand(name, input, this.execution(context), validateOnly);
    }
    performQuery(name: string, input: unknown, context: Partial<ExecutionContext> = {}, options?: QueryOptions): Promise<QueryResult> {
        return this.server.performQuery(name, input, this.execution(context), options);
    }
    /** Opens a live query through the real pipeline; close the session after collecting emissions. */
    observeQuery(name: string, input: unknown, context: Partial<ExecutionContext> = {}, options?: QueryOptions): Promise<ObservableQuerySession> {
        return this.server.openObservableQuery(name, input, this.execution(context), options);
    }
    handle(request: Request): Promise<Response | null> { return this.server.handle(request); }
    dispose(): Promise<void> { return this.server.dispose(); }
}
