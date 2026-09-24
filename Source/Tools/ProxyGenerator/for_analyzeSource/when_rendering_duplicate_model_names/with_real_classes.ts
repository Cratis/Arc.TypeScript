// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { resolve } from 'node:path';
import ts from 'typescript';
import { vi } from 'vitest';
import { analyzeSource } from '../../analyzeSource.js';
import { renderSource } from '../../renderSource.js';

const root = resolve(import.meta.dirname, '../given/duplicate_project');
const artifacts = resolve(root, 'artifacts');

describe('when rendering duplicate model names from real classes', () => {
    const files = renderSource(analyzeSource(resolve(root, 'tsconfig.json'), artifacts, '', true), { jsImportSpecifiers: true });
    it('should alias a model that collides with its containing class', () => {
        files.get('Orders/Item.ts')!.should.include('import { Item as Invoices_Item }');
        files.get('Orders/Item.ts')!.should.include('@field(Invoices_Item)');
    });
    it('should compile generated models and queries with tsc', () => {
        vi.setConfig({ testTimeout: 30000 });
        const clientRoot = resolve(process.cwd(), 'ContractTests/Client');
        const clientSource = resolve(clientRoot, 'src');
        const virtual = new Map([...files].map(([path, text]) => [resolve(clientSource, path), text]));
        const config = ts.readConfigFile(resolve(clientRoot, 'tsconfig.json'), ts.sys.readFile);
        const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, clientRoot);
        const host = ts.createCompilerHost(parsed.options);
        const read = host.readFile.bind(host);
        const exists = host.fileExists.bind(host);
        host.readFile = path => virtual.get(path) ?? read(path);
        host.fileExists = path => virtual.has(path) || exists(path);
        const directoryExists = host.directoryExists?.bind(host);
        host.directoryExists = path => path.startsWith(clientSource) || directoryExists?.(path) === true;
        const program = ts.createProgram([...virtual.keys()], { ...parsed.options, noEmit: true }, host);
        const diagnostics = ts.getPreEmitDiagnostics(program);
        diagnostics.map(diagnostic => ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')).should.deep.equal([]);
    });
});
