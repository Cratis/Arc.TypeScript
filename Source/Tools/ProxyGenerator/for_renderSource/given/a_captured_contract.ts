// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { SourceType } from '../../SourceType.js';
import { ClientOperationKind } from '@cratis/arc.core';

// Semantic goldens from Arc.Kotlin/GradlePlugin/src/test/resources/differential/dotnet/
// Commands/CreateFixtures.ts and Models/{All,Observe,Search}.ts.
const model: SourceType = { text: 'FixtureModel[]', constructor: 'FixtureModel', model: 'FixtureModel',
    enumerable: true, nullable: false, void: false };
const string: SourceType = { text: 'string', constructor: 'String', enumerable: false, nullable: false, void: false };
const params = [{ name: 'filter', type: string, optional: false }];

export class a_captured_contract {
    readonly analysis = { models: [{ kind: 'model' as const, name: 'FixtureModel', namespace: 'differential.fixture.models', fields: [
        { name: 'filter', type: string, optional: false }] }], operations: [
        { kind: ClientOperationKind.Command, name: 'CreateFixtures', owner: 'CreateFixtures', namespace: 'differential.fixture.commands',
            routeOverride: '/api/commands/create-fixtures', fields: [{ name: 'fixtureId', type: string, optional: false }],
            roles: ['creator', 'admin'], result: model },
        { kind: ClientOperationKind.Query, name: 'all', owner: 'FixtureModel', namespace: 'differential.fixture.models',
            routeOverride: '/api/models/all', fields: [], roles: [], result: model },
        { kind: ClientOperationKind.Observable, name: 'observe', owner: 'FixtureModel', namespace: 'differential.fixture.models',
            routeOverride: '/api/models/observe', fields: params, roles: [], result: model },
        { kind: ClientOperationKind.Query, name: 'search', owner: 'FixtureModel', namespace: 'differential.fixture.models',
            routeOverride: '/custom/fixture-search', fields: params, roles: ['viewer', 'auditor'], result: model }
    ] };
}
