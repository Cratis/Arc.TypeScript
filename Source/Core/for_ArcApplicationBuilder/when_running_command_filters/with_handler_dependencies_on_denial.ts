// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { z } from 'zod';
import { beforeEach, afterEach, describe, it, should } from 'vitest';
import { given } from '../../given.js';
import { ArcApplication } from '../../ArcApplication.js';
import { defineCommand } from '../../commands/defineCommand.js';
import type { CommandResult } from '../../commands/CommandResult.js';
import type { FetchArcApplication } from '../../FetchArcApplication.js';
import { command_filter_fixture } from '../given/command_filter_fixture.js';
should();

describe('when running command filters with handler dependencies on denial', given(command_filter_fixture, context => {
    let result: CommandResult;
    let instances: number;
    let application: FetchArcApplication;
    beforeEach(async () => {
        instances = 0;
        context.calls.length = 0;
        class Dependency {}
        const builder = ArcApplication.createBuilder({ commands: [defineCommand({
            name: 'Gated', schema: z.object({ value: z.string() }), authorization: { anonymous: true },
            handlerDependencies: [Dependency], handle: () => { context.calls.push('handle'); }
        })] });
        builder.services.addScoped(Dependency, () => { instances++; return new Dependency(); });
        builder.services.addScoped(context.authorization);
        builder.addAuthorizationCommandFilter(context.authorization);
        application = await builder.build();
        result = await application.server.executeCommand('Gated', { value: 'denied' }, context.execution);
    });
    afterEach(async () => { await application.dispose(); });
    it('should deny the command', () => { result.isAuthorized.should.equal(false); });
    it('should not construct handler dependencies', () => { instances.should.equal(0); });
    it('should not invoke the handler', () => { context.calls.should.deep.equal(['authorization']); });
}));
