// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command, currentContext } from '@cratis/arc.core';

@command()
export class ContextCommand {
    handle(): string { return `${currentContext()?.tenantId}:${currentContext()?.correlationId}`; }
}
