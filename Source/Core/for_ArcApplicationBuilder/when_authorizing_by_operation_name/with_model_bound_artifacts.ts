// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { beforeEach, describe, it, should } from 'vitest';
import { ArcApplication } from '../../ArcApplication.js';
import type { CommandContext } from '../../commands/CommandContext.js';
import type { QueryContext } from '../../queries/QueryContext.js';
import { unauthorizedCommandResult } from '../../commands/unauthorizedCommandResult.js';
import { unauthorizedQueryResult } from '../../queries/unauthorizedQueryResult.js';
import { RegisterItem } from '../given/RegisterItem.js';
import { Item } from '../given/Item.js';
import { Items } from '../given/Items.js';
should();

describe('when authorizing model-bound artifacts by declared name', () => {
    let names: string[];
    let declared: string[];
    let commandAllowed: boolean;
    let queryAllowed: boolean;
    beforeEach(async () => {
        names = [];
        class CommandGate { onExecution(context: CommandContext) {
            names.push(context.operationName ?? 'missing');
            if (context.operationName !== 'RegisterItem') return unauthorizedCommandResult(context);
        } }
        class QueryGate { onPerform(context: QueryContext) {
            names.push(context.operationName ?? 'missing');
            if (context.operationName !== 'Item.byName') return unauthorizedQueryResult(context);
        } }
        const builder = ArcApplication.createBuilder();
        builder.services.addSingleton(Items, () => new Items()).addScoped(CommandGate).addScoped(QueryGate);
        builder.add(RegisterItem, Item).addAuthorizationCommandFilter(CommandGate).addAuthorizationQueryFilter(QueryGate);
        const application = await builder.build();
        declared = [...application.server.commands, ...application.server.queries].map(item => item.fullyQualifiedName);
        const execution = { correlationId: 'model-identity', allowedSeverity: 2, principal: undefined, tenantId: undefined,
            signal: new AbortController().signal };
        commandAllowed = (await application.server.executeCommand('RegisterItem', { name: 'First' }, execution)).isSuccess;
        queryAllowed = (await application.server.performQuery('Item.byName', { name: 'First' }, execution)).isSuccess;
        await application.dispose();
    });
    it('should use the exact introspection names on the command and query contexts', () => {
        names.should.deep.equal(['RegisterItem', 'Item.byName']);
        declared.should.contain('RegisterItem');
        declared.should.contain('Item.byName');
    });
    it('should admit both model-bound operations', () => {
        commandAllowed.should.equal(true);
        queryAllowed.should.equal(true);
    });
});
