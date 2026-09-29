// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { analyzeSource } from '../../analyzeSource.js';
import { renderSource } from '../../renderSource.js';

const root = resolve(import.meta.dirname, '../given/mapped_project');
const money = { package: '@acme/money' };

describe('when compiling generated output that references mapped types', () => {
    let diagnostics: readonly ts.Diagnostic[];
    beforeEach(() => {
        const files = renderSource(analyzeSource(resolve(root, 'tsconfig.json'), resolve(root, 'artifacts'), '', true, undefined, undefined, undefined,
            { 'Shared.Money': money, 'Shared.Entity': money, 'Shared.Currency': money }), { jsImportSpecifiers: true });
        const clientRoot = resolve(process.cwd(), 'ContractTests/Client');
        const clientSource = resolve(clientRoot, 'src');
        const virtual = new Map([...files].map(([path, text]) => [resolve(clientSource, path), text]));
        const config = ts.readConfigFile(resolve(clientRoot, 'tsconfig.json'), ts.sys.readFile);
        const parsed = ts.convertCompilerOptionsFromJson(config.config.compilerOptions, clientRoot);
        if (parsed.errors.length) throw new Error(ts.formatDiagnostics(parsed.errors, {
            getCanonicalFileName: path => path, getCurrentDirectory: () => clientRoot, getNewLine: () => '\n'
        }));
        // The tiny local package stands in for @acme/money; the paths target is absolute so no base URL is needed.
        const options = { ...parsed.options, noEmit: true, skipLibCheck: true, rootDir: process.cwd(),
            paths: { '@acme/money': [resolve(root, 'packages/money/index.ts')] } };
        const host = ts.createCompilerHost(options);
        const read = host.readFile.bind(host);
        const exists = host.fileExists.bind(host);
        host.readFile = path => virtual.get(path) ?? read(path);
        host.fileExists = path => virtual.has(path) || exists(path);
        const directoryExists = host.directoryExists?.bind(host);
        host.directoryExists = path => path.startsWith(clientSource) || directoryExists?.(path) === true;
        diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([...virtual.keys()], options, host));
    });
    it('should compile the generated proxies against the mapped package with strict settings', () => {
        diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).should.deep.equal([]);
    });
});
