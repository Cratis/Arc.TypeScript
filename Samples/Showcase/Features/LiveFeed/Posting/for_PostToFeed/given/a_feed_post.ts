// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { CommandScenario } from '@cratis/arc.testing';
import { LiveFeedStore } from '../../../LiveFeedStore.js';
import { PostToFeed, PostToFeedValidator } from '../../Posting.js';
import { metadata } from '../../../../generatedMetadata.js';

export class a_feed_post {
    feed = new LiveFeedStore();
    scenario = CommandScenario.for(PostToFeed, PostToFeedValidator);

    constructor() {
        this.scenario.extend(builder => builder.useGeneratedMetadata(metadata));
        this.scenario.services.addSingleton(LiveFeedStore, this.feed);
    }
}
