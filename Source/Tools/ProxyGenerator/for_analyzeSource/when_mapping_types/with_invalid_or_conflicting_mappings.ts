// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import { analyzeSource } from '../../analyzeSource.js';
import { renderSource } from '../../renderSource.js';
import { parseSourceOptions } from '../../parseSourceOptions.js';
import { parseTypeMappingOptions, type TypeMappings } from '../../typeMappings.js';

const project = resolve(import.meta.dirname, '../given/collision_project/tsconfig.json');
const artifacts = resolve(import.meta.dirname, '../given/collision_project/artifacts');
const analyze = (mappings: TypeMappings, diagnostics: string[] = []) => renderSource(analyzeSource(project, artifacts, '', true, undefined, undefined,
    undefined, mappings), { onDiagnostic: message => diagnostics.push(message) });

describe('when mapping types with invalid or conflicting settings', () => {
    it('should fail when a mapped export collides with an import the generator needs', () => {
        (() => analyze({ 'Shared.Command': { package: '@acme/money' } })).should.throw(/Type mapping export 'Command' collides.*Orders\/Shadow\.ts/);
    });
    it('should fail when a mapped export collides with a generated declaration', () => {
        (() => analyze({ 'Shared.Command': { package: '@acme/money', export: 'Shadow' } })).should.throw(/'Shadow' collides.*Orders\/Shadow\.ts/);
    });
    it('should fail when a key is not a namespace-qualified name', () => {
        (() => analyze({ 'Shared/Command': { package: '@acme/money' } })).should.throw(/Invalid type mapping key/);
    });
    it('should fail when the package is not a package name', () => {
        (() => analyze({ 'Shared.Command': { package: "x'; evil" } })).should.throw(/Invalid package/);
    });
    it('should fail when the export is not an identifier', () => {
        (() => analyze({ 'Shared.Command': { package: '@acme/money', export: 'not valid' } })).should.throw(/Invalid export/);
    });
    it('should report a mapping that matched no type', () => {
        const diagnostics: string[] = [];
        analyze({ 'Shared.Comand': { package: '@acme/money' } }, diagnostics);
        diagnostics.should.deep.equal([expectedUnused()]);
    });
    it('should fail when the command line maps one type twice', () => {
        (() => parseTypeMappingOptions(['Shared.Money=@a/one', 'Shared.Money=@b/two'])).should.throw(/Duplicate type mapping for 'Shared.Money'/);
    });
    it('should fail on a malformed command line mapping', () => {
        (() => parseTypeMappingOptions(['Shared.Money'])).should.throw(/expected <Type>=<package>\[#<export>\]/);
    });
    it('should read repeated command line mappings with an optional export', () => {
        parseSourceOptions(['--project', '/p', '--artifacts', '/a', '--output', '/o', '--type-mapping', 'A.Money=@acme/money#Price',
            '--type-mapping=A.Entity=@acme/money'], 'usage').configuration.typeMappings!.should.deep.equal({
            'A.Money': { package: '@acme/money', export: 'Price' }, 'A.Entity': { package: '@acme/money' } });
    });
});
function expectedUnused(): string {
    return `Type mapping 'Shared.Comand' did not match any type reachable from ${artifacts}; check its namespace-qualified name`;
}
