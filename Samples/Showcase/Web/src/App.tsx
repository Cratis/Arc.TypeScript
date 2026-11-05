// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState } from 'react';
import { Arc } from '@cratis/arc.react';
import { AuthenticationPage } from '../../Features/Authentication/AuthenticationPage';
import { ChangeStreamPage } from '../../Features/ChangeStream/ChangeStreamPage';
import { SecuredPanel } from '../../Features/CrossCuttingAuthorization/Securing/SecuredPanel';
import { LiveFeedPage } from '../../Features/LiveFeed/LiveFeedPage';
import { MongoWatcherPage } from '../../Features/MongoWatcher/MongoWatcherPage';
import { ObservableCollectionPage } from '../../Features/ObservableCollection/ObservableCollectionPage';
import { ObservableCollectionWithGuidPage } from '../../Features/ObservableCollectionWithGuid/ObservableCollectionWithGuidPage';
import { QueryShowcasePage } from '../../Features/QueryShowcase/QueryShowcasePage';
import { TickerView } from '../../Features/Ticker/Observing/TickerView';
import { Toolbar } from './Toolbar';
import { applySettings } from './settings';

const pages = {
    Ticker: TickerView,
    'Live feed': LiveFeedPage,
    'Query showcase': QueryShowcasePage,
    Authentication: AuthenticationPage,
    'Cross-cutting authorization': SecuredPanel,
    'Observable collection': ObservableCollectionPage,
    'Collection with Guid': ObservableCollectionWithGuidPage,
    'Change stream': ChangeStreamPage,
    MongoDB: MongoWatcherPage
};

const settings = applySettings();

export function App() {
    const [current, setCurrent] = useState<keyof typeof pages>('Ticker');
    const Page = pages[current];
    return <Arc><div>
        <Toolbar settings={settings} />
        <nav>{(Object.keys(pages) as (keyof typeof pages)[]).map(name =>
            <button key={name} aria-current={name === current} onClick={() => setCurrent(name)}>{name}</button>)}</nav>
        <main><Page /></main>
    </div></Arc>;
}
