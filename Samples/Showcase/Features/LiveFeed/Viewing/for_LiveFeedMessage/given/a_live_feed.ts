// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ObservableQueryScenario } from '@cratis/arc.testing';
import { LiveFeedStore } from '../../../LiveFeedStore.js';
import { LiveFeedMessage } from '../../Viewing.js';
import { metadata } from '../../../../generatedMetadata.js';

type Messages = { id: string; author: string; text: string }[];

export class a_live_feed {
    feed = new LiveFeedStore();
    all = ObservableQueryScenario.for<Messages>(LiveFeedMessage, 'all');
    byAuthor = ObservableQueryScenario.for<Messages>(LiveFeedMessage, 'byAuthor');

    constructor() {
        for (const scenario of [this.all, this.byAuthor]) {
            scenario.extend(builder => builder.useGeneratedMetadata(metadata));
            scenario.services.addSingleton(LiveFeedStore, this.feed);
        }
    }
}
