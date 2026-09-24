// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

/** One compiler program shared by client proxies and generated server metadata. */
export function sourceProgram(project: string): ts.Program {
    const configuration = ts.readConfigFile(project, ts.sys.readFile);
    if (configuration.error) throw new Error(ts.flattenDiagnosticMessageText(configuration.error.messageText, '\n'));
    const parsed = ts.parseJsonConfigFileContent(configuration.config, ts.sys, dirname(resolve(project)), undefined, resolve(project));
    if (parsed.errors.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(parsed.errors, {
        getCanonicalFileName: file => file, getCurrentDirectory: ts.sys.getCurrentDirectory, getNewLine: () => '\n'
    }));
    return ts.createProgram(parsed.fileNames, parsed.options);
}
