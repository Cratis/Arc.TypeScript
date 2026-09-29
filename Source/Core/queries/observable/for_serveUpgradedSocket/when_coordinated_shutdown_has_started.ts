// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { should } from 'vitest';
import { ArcServer } from '../../../ArcServer.js';
import { serveUpgradedSocket } from '../serveUpgradedSocket.js';
import type { NodeWebSocketLike } from '../NodeWebSocketLike.js';
import { Severity } from '../../../validation/Severity.js';

should();

describe('when serving an upgraded socket after coordinated shutdown has started', () => {
    let closeCode: number | undefined;
    let listened: boolean;
    let completed: boolean;

    beforeEach(async () => {
        closeCode = undefined;
        listened = false;
        completed = false;
        const server = new ArcServer({});
        const socket = {
            close: (code: number) => { closeCode = code; },
            on: () => { listened = true; }
        } as unknown as NodeWebSocketLike;
        server.services.addShutdownParticipant({ stop: async () => {
            const bridge = serveUpgradedSocket(server, socket, new Request('http://arc.invalid/.cratis/queries/ws'),
                undefined, { authenticationFailed: false, context: { correlationId: 'c', principal: undefined,
                    tenantId: undefined, remoteAddress: undefined, signal: new AbortController().signal,
                    allowedSeverity: Severity.Warning } });
            await bridge.completion;
            completed = true;
        }, drain: async () => {} });
        await server.dispose();
    });

    it('should close the socket as going away', () => should().equal(closeCode, 1001));
    it('should not start protocol work on the socket', () => listened.should.be.false);
    it('should complete the bridge', () => completed.should.be.true);
});
