// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { command, CommandValidator, validator } from '@cratis/arc.core';
import { LiveFeedStore } from '../LiveFeedStore.js';

/** Post a message to the live feed. */
@command()
export class PostToFeed {
    @field(String) author!: string;
    @field(String) text!: string;

    handle(feed: LiveFeedStore): void { feed.post(this.author, this.text); }
}

@validator(PostToFeed)
export class PostToFeedValidator extends CommandValidator<PostToFeed> {
    constructor() {
        super();
        this.ruleFor(command => command.author).notEmpty().withMessage('An author is required');
        this.ruleFor(command => command.text).notEmpty().withMessage('A message is required');
        this.ruleFor(command => command.text).maxLength(280).withMessage('A message can have at most 280 characters');
    }
}
