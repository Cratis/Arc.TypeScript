// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { allowAnonymous, command } from '@cratis/arc.core';

@command({ namespace: 'HttpFixture' })
@allowAnonymous()
export class ModelBoundCommand {
    @field(String) title!: string;
    handle(): string { return this.title; }
}
