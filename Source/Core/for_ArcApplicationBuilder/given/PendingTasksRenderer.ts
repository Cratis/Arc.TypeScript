// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { QueryRenderer } from '../../queries/QueryRenderer.js';
import { queryRenderer } from '../../queries/queryRendererDecorator.js';
import { queryPage } from '../../queries/QueryPage.js';
import { Task } from '../../queries/for_queryRendering/given/Task.js';

/** Discovered provider-owned page renderer. */
@queryRenderer()
export class PendingTasksRenderer implements QueryRenderer {
    canRender(value: unknown): boolean { return value === 'provider'; }
    render(): unknown { return queryPage([new Task('one')], 1); }
}
