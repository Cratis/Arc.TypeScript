// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ClientOperationKind, QueryHttpMethod } from '@cratis/arc.core';
import { renderSource } from '../../renderSource.js';
import type { SourceAnalysis } from '../../SourceAnalysis.js';

describe('when emitting client preferences with static declarations', () => {
    let files: ReadonlyMap<string, string>;
    beforeEach(() => {
        const result = { text: 'string', constructor: 'String', enumerable: false, nullable: false, void: false };
        const analysis: SourceAnalysis = { models: [], operations: [
            { kind: ClientOperationKind.Command, name: 'Save', owner: 'Save', namespace: 'Tasks', fields: [], roles: [], result,
                treatWarningsAsErrors: true },
            { kind: ClientOperationKind.Query, name: 'find', owner: 'Task', namespace: 'Tasks', fields: [], roles: [], result,
                treatWarningsAsErrors: true, httpMethod: QueryHttpMethod.Query }
        ] };
        files = renderSource(analysis);
    });
    it('should emit the command warning preference', () => {
        files.get('Tasks/Save.ts')!.should.include('readonly treatWarningsAsErrors: boolean = true;');
    });
    it('should emit the query method and warning preference', () => {
        files.get('Tasks/Find.ts')!.should.include('this.setHttpMethod(QueryHttpMethod.Query);');
        files.get('Tasks/Find.ts')!.should.include('readonly treatWarningsAsErrors: boolean = true;');
    });
});
