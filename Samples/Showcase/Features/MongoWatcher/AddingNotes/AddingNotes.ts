// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field, Guid } from '@cratis/fundamentals';
import { command, CommandValidator, inject, validator } from '@cratis/arc.core';
import { mongoCollection, type MongoCollection } from '@cratis/arc.mongodb';
import { WatcherNote } from '../WatcherNote.js';

/** Add a note to the current tenant's collection. */
@command()
export class AddWatcherNote {
    @field(String) text!: string;

    @inject(mongoCollection(WatcherNote))
    async handle(notes: MongoCollection<WatcherNote>): Promise<void> {
        await notes.native.insertOne(notes.codec.serialize({ id: Guid.create(), text: this.text }));
    }
}

@validator(AddWatcherNote)
export class AddWatcherNoteValidator extends CommandValidator<AddWatcherNote> {
    constructor() {
        super();
        this.ruleFor(command => command.text).notEmpty().withMessage('A note is required');
    }
}
