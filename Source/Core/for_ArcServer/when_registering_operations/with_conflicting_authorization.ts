// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();
describe('when registering operations with conflicting authorization', () => {
    let errors: unknown[];
    let resourceChecksAccepted: boolean;
    const capture = (callback: () => unknown) => { try { callback(); return undefined; } catch (error) { return error; } };
    beforeEach(() => {
        const command = (authorization: { anonymous: boolean; authenticated?: boolean; roles?: string[] }) =>
            defineCommand({ name: 'Save', schema: z.object({}), authorization, handle: () => 1 });
        const query = (authorization: { anonymous: boolean; authenticated?: boolean; roles?: string[] }) =>
            defineQuery({ name: 'List', schema: z.object({}), authorization, perform: () => 1 });
        errors = [{ anonymous: true, roles: ['Admin'] }, { anonymous: true, authenticated: true }].flatMap(authorization => [
            capture(() => new ArcServer({ commands: [command(authorization)] })),
            capture(() => new ArcServer({ queries: [query(authorization)] }))
        ]);
        resourceChecksAccepted = capture(() => new ArcServer({ commands: [defineCommand({ name: 'Save', schema: z.object({}), authorization: { anonymous: true }, authorize: () => true, handle: () => 1 })] })) === undefined;
    });
    it('should reject contradictory anonymous and protected command or query metadata', () => {
        errors.should.have.lengthOf(4);
        for (const error of errors) (error as Error).message.should.contain('Conflicting Arc authorization');
    });
    it('should allow resource checks on a public command', () => resourceChecksAccepted.should.equal(true));
});
