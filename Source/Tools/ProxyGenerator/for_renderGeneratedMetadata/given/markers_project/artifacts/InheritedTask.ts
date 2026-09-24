// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, rejected, validation, type Outcome } from '@cratis/arc.core';
import { Prepared } from './Prepared.js';

export class BaseTask {
    @field(String) title!: string;
    provide(): Prepared | Outcome<never> {
        if (!this.title) return rejected(validation('Title required', ['title']));
        return new Prepared();
    }
    handle(prepared: Prepared, service: Prepared): void { void prepared; void service; }
}

@command()
export class InheritedTask extends BaseTask {
    @field(Number) count!: number;
}
