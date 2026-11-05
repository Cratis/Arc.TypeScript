// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Anonymous } from './Anonymous.proxy';
import { Authenticated } from './Authenticated.proxy';

function Answer({ title, result }: { title: string; result: { isAuthorized: boolean; data?: { message: string } } }) {
    return <div><h3>{title}</h3>{result.isAuthorized ? <p>{result.data?.message ?? '…'}</p> : <p className="problem">Not authorized (401/403)</p>}</div>;
}

/** One query anyone may call and one that needs a signed in user. */
export function AuthenticationQueriesView() {
    const [anonymous] = Anonymous.use();
    const [authenticated] = Authenticated.use();
    return <div className="columns"><Answer title="Anonymous query" result={anonymous} /><Answer title="Authenticated query" result={authenticated} /></div>;
}
