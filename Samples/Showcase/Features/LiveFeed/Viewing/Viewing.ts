// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { query, readModel } from '@cratis/arc.core';
import { map, type BehaviorSubject, type Observable } from 'rxjs';
import { LiveFeedStore } from '../LiveFeedStore.js';

/** A message on the live feed. */
@readModel()
export class LiveFeedMessage {
    @field(String) id!: string;
    @field(String) author!: string;
    @field(String) text!: string;
    @field(String) postedAt!: string;

    @query()
    static all(feed: LiveFeedStore): BehaviorSubject<LiveFeedMessage[]> { return feed.all(); }

    @query()
    static byAuthor(author: string, feed: LiveFeedStore): Observable<LiveFeedMessage[]> {
        return feed.all().pipe(map(messages => messages.filter(message => message.author === author)));
    }
}
