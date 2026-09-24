// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { wireName } from '@cratis/arc.core';
import type { SourceOperation } from './SourceOperation.js';
import { quote, typeImports, type SourceRenderOptions } from './renderSource.js';
import { renderRecordedRules } from './renderRecordedRules.js';
import type { RecordedRule } from './RecordedRule.js';

export function renderCommand(operation: SourceOperation, path: string, destinations: ReadonlyMap<string, string>, route: string,
    rules: readonly RecordedRule[] = [], diagnostic: (message: string) => void = message => process.stderr.write(`${message}\n`), options: SourceRenderOptions = {}): string {
    const name = operation.name;
    const validation = renderRecordedRules(name, 'CommandValidator', `I${name}`, rules, diagnostic, operation.fields.map(field => wireName(field.name)));
    const result = operation.result;
    const imports = [...new Set([result, ...operation.fields.map(field => field.type)].flatMap(type => typeImports(type, path, destinations, options)))].sort();
    const descriptorFields = operation.fields.map(field => `        new PropertyDescriptor(${quote(wireName(field.name))}, ${options.emitInterfaces && field.type.model ? 'Object' : field.type.constructor}, ${field.type.nullable || field.optional}),`).join('\n');
    const fieldType = (field: SourceOperation['fields'][number]): string => `${field.type.text}${field.nullable ? ' | null' : ''}`;
    const fields = operation.fields.map(field => `    private _${wireName(field.name)}${field.optional ? '?' : '!'}: ${fieldType(field)};`).join('\n');
    const properties = operation.fields.map(field => `    get ${wireName(field.name)}(): ${fieldType(field)}${field.optional ? ' | undefined' : ''} {\n        return this._${wireName(field.name)};\n    }\n\n    set ${wireName(field.name)}(value: ${fieldType(field)}${field.optional ? ' | undefined' : ''}) {\n        this._${wireName(field.name)} = value;\n        this.propertyChanged(${quote(wireName(field.name))});\n    }`).join('\n\n');
    return `import { Command${validation ? ', CommandValidator' : ''} } from '@cratis/arc/commands';\nimport { useCommand, type SetCommandValues, type ClearCommandValues } from '@cratis/arc.react/commands';\nimport { PropertyDescriptor } from '@cratis/arc/reflection';\n${imports.join('\n')}${imports.length ? '\n' : ''}\nexport interface I${name} {\n${operation.fields.map(field => `    ${wireName(field.name)}?: ${fieldType(field)};`).join('\n')}\n}\n\n${validation}export class ${name} extends Command<I${name}${result.void ? '' : `, ${result.text}`}> implements I${name} {\n    readonly route: string = ${quote(route)};\n${validation ? `    readonly validation: CommandValidator = new ${name}Validator();\n` : ''}    readonly treatWarningsAsErrors: boolean = false;\n    readonly roles: string[] = [${operation.roles.map(quote).join(', ')}];\n    readonly propertyDescriptors: PropertyDescriptor[] = [\n${descriptorFields}\n    ];\n${fields ? `\n${fields}\n` : ''}\n    constructor() {\n        super(${result.void || options.emitInterfaces && result.model ? 'Object' : result.constructor}, ${result.enumerable});\n    }\n\n    get requestParameters(): string[] { return []; }\n\n${properties}${properties ? '\n\n' : ''}    static use(initialValues?: I${name}): [${name}, SetCommandValues<I${name}>, ClearCommandValues] {\n        return useCommand<${name}, I${name}>(${name}, initialValues);\n    }\n}\n`;
}
