// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { PostForm } from './Posting/PostForm';
import { FeedList } from './Viewing/FeedList';

export function LiveFeedPage() {
    return <section><h2>Live feed</h2><PostForm /><FeedList /></section>;
}
