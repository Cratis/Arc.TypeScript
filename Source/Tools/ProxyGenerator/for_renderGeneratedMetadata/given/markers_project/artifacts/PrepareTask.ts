// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, type CommandContext } from '@cratis/arc.core';
import { TaskDetail } from './TaskDetail.js';
import { Prepared } from './Prepared.js';

@command()
export class PrepareTask {
    provide(context: CommandContext, signal: AbortSignal): Prepared {
        void context; void signal;
        return new Prepared();
    }
    handle(prepared: Prepared, model: TaskDetail | null, context: CommandContext, signal: AbortSignal): void {
        void model; void context; void signal; void prepared;
    }
}
