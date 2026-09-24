// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { runtimePost } from '../given/a_runtime_request.js';

should();
describe('when handling a validate-named command with explicit routes', () => {
    let defaultResult: unknown;
    let customResult: unknown;
    beforeEach(async () => {
        const server = new ArcServer({ commands: [
            defineCommand<z.ZodType, { kind: string; value: number }>({ name: 'Validate', schema: z.object({}), handle: () => ({ kind: 'denied', value: 1 }) }),
            defineCommand<z.ZodType, { kind: string; value: number }>({ name: 'Check', path: '/x/validate', schema: z.object({}), handle: () => ({ kind: 'validation', value: 2 }) })
        ] });
        defaultResult = (await (await server.handle(runtimePost('/api/validate', {})))!.json()).response;
        customResult = (await (await server.handle(runtimePost('/x/validate', {})))!.json()).response;
        await server.dispose();
    });
    it('should execute the validate-named operation', () => defaultResult!.should.deep.equal({ kind: 'denied', value: 1 }));
    it('should execute a custom validate-suffixed path', () => customResult!.should.deep.equal({ kind: 'validation', value: 2 }));
});
