// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Arc } from '@cratis/arc.react';
import { RegisterAuthorForm } from './Features/Authors/Registration/RegisterAuthorForm';
import { AuthorCatalog } from './Features/Authors/Listing/AuthorCatalog';

export function App() {
    return <Arc><main>
        <header><span className="eyebrow">CRATIS · ARC FOR TYPESCRIPT</span><h1>The Library</h1>
            <p>Make room for a new story. Register an author, then fill their shelf.</p></header>
        <div className="layout"><section className="card"><h2>Register an author</h2><RegisterAuthorForm /></section>
            <section className="card catalog"><h2>Authors &amp; books</h2><AuthorCatalog /></section></div>
    </main></Arc>;
}
