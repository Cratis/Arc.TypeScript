// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field, Guid } from '@cratis/fundamentals';
import { allowAnonymous, command } from '@cratis/arc.core';

@command({ namespace: 'HttpFixture' })
@allowAnonymous()
export class GuidCommand {
    @field(Guid) id!: Guid;
    handle(): Guid { return this.id; }
}
