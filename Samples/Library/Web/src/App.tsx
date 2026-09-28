// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Arc } from '@cratis/arc.react';
import { CratisComponentsProvider } from '@cratis/components';
import { AuthorCatalog } from '../../Features/Authors/Listing/AuthorCatalog';

export function App() {
    return <Arc><CratisComponentsProvider value={{ locale: 'en-US' }} toaster><main>
        <header><span className="eyebrow">CRATIS · ARC FOR TYPESCRIPT</span><h1>The Library</h1>
            <p>Make room for a new story. Register an author, then fill their shelf.</p></header>
        <AuthorCatalog />
    </main></CratisComponentsProvider></Arc>;
}
