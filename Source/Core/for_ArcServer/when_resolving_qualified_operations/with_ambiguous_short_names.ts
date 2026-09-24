// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { z } from 'zod';
import { ArcServer } from '../../ArcServer.js';
import { defineCommand } from '../../commands/defineCommand.js';
import { defineQuery } from '../../queries/defineQuery.js';
import { Severity } from '../../validation/Severity.js';

should();
describe('when resolving qualified operations with ambiguous short names', () => {
    let commandResponse: unknown;
    let queryData: unknown;
    let commandError: unknown;
    let queryError: unknown;
    beforeEach(async () => {
        const commands = ['Alpha', 'Beta'].map(namespace => defineCommand({ name: 'Create', namespace, schema: z.object({}), handle: () => namespace }));
        const queries = ['Alpha', 'Beta'].map(namespace => defineQuery({ name: 'List', namespace, schema: z.object({}), perform: () => namespace }));
        const server = new ArcServer({ commands, queries });
        const context = { correlationId: crypto.randomUUID(), principal: undefined, tenantId: undefined, allowedSeverity: Severity.Warning, signal: new AbortController().signal };
        commandResponse = (await server.executeCommand('Beta.Create', {}, context)).response;
        queryData = (await server.performQuery('Alpha.List', {}, context)).data;
        commandError = await server.executeCommand('Create', {}, context).then(() => undefined, error => error as unknown);
        queryError = await server.performQuery('List', {}, context).then(() => undefined, error => error as unknown);
        await server.dispose();
    });
    it('should resolve the fully qualified command', () => commandResponse!.should.equal('Beta'));
    it('should resolve the fully qualified query', () => queryData!.should.equal('Alpha'));
    it('should reject an ambiguous command name', () => (commandError as Error).message.should.match(/Unknown command/));
    it('should reject an ambiguous query name', () => (queryError as Error).message.should.match(/Unknown query/));
});
