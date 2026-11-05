// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { useState } from 'react';
import { RunSecuredCommand } from './RunSecuredCommand.proxy';
import { Secured } from './Secured.proxy';

/** Neither artifact declares a role; a global authorization filter lets only admins through. */
export function SecuredPanel() {
    const [command, setValues] = RunSecuredCommand.use();
    const [status] = Secured.use();
    const [outcome, setOutcome] = useState('');

    const run = async () => {
        setValues({ reason: 'Clicked in the showcase' });
        const result = await command.execute();
        setOutcome(result.isAuthorized ? 'The command ran.' : 'Denied by the cross-cutting filter.');
    };
    return <section><h2>Cross-cutting authorization</h2>
        <p>Sign in as Ada (admin) to pass the filter, or as Grace (reader), or stay anonymous, to be denied.</p>
        <button onClick={run}>Run secured command</button> <span>{outcome}</span>
        <p>{status.isAuthorized ? `Secured actions run: ${status.data.runs}` : 'The secured query was denied (403).'}</p>
    </section>;
}
