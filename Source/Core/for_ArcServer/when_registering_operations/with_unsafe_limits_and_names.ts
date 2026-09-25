// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { defineQuery } from '../../queries/defineQuery.js';

should();
describe('when registering operations with unsafe limits and names', () => {
    let limits: unknown[];
    let commands: unknown[];
    let query: unknown;
    let route: string;
    const capture = (callback: () => unknown) => { try { callback(); return undefined; } catch (error) { return error; } };
    beforeEach(() => {
        limits = [0, -1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER + 1].map(maxBodyBytes => capture(() => new ArcServer({ hosting: { maxBodyBytes } })));
        commands = ['Bad/Name', '', 'Bad-Name'].map(name => capture(() => new ArcServer({ commands: [defineCommand({ name, path: '/custom', schema: z.object({}), handle: () => 1 })] })));
        query = capture(() => new ArcServer({ queries: [defineQuery({ name: 'List', namespace: 'Bad..Name', path: '/custom', schema: z.object({}), perform: () => 1 })] }));
        route = new ArcServer({ queries: [defineQuery({ name: 'HTTPReader', namespace: 'API.Users', schema: z.object({}), perform: () => 1 })] }).queries[0]!.route;
    });
    it('should reject unsafe body limits', () => limits.forEach(error => (error instanceof Error).should.equal(true)));
    it('should reject invalid command names even for custom paths', () => commands.forEach(error => (error instanceof Error).should.equal(true)));
    it('should reject invalid query namespaces even for custom paths', () => (query instanceof Error).should.equal(true));
    it('should split acronyms in default routes', () => route.should.equal('/api/api/users/http-reader'));
});
