// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcServer } from '../../../../ArcServer.js';
import { serveUpgradedSocket } from '../../serveUpgradedSocket.js';
import type { NodeWebSocketLike } from '../../NodeWebSocketLike.js';
import type { ResolvedConnectionContext } from '../../ResolvedConnectionContext.js';

should();

describe('when serving an upgrade without a resolved context', () => {
    let server: ArcServer;
    let closeCode: number | undefined;
    let failure: Error | undefined;

    beforeEach(() => {
        server = new ArcServer({});
        const socket = { close: (code: number) => { closeCode = code; } } as NodeWebSocketLike;
        try {
            serveUpgradedSocket(server, socket, new Request('http://arc.invalid/.cratis/queries/ws'),
                undefined, undefined as unknown as ResolvedConnectionContext);
        } catch (error) { failure = error as Error; }
    });

    afterEach(async () => { await server.dispose(); });

    it('should reject the upgrade before serving the socket', () => {
        should().equal(closeCode, 1008);
        should().equal(failure?.message, 'Resolved observable connection context is required');
    });
});
