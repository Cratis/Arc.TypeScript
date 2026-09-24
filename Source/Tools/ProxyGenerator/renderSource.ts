// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { dirname, join, relative } from 'node:path';
import { includeRouteName, routeFor } from '@cratis/arc.core';
import type { SourceAnalysis } from './SourceAnalysis.js';
import type { SourceModel } from './SourceModel.js';
import type { SourceOperation } from './SourceOperation.js';
import type { SourceType } from './SourceType.js';
import { renderSourceQuery } from './renderSourceQuery.js';
import { renderRecordedRules } from './renderRecordedRules.js';
import type { RecordedRule } from './RecordedRule.js';

export interface SourceRenderOptions {
    readonly segmentsToSkip?: number;
    readonly apiPrefix?: string;
    readonly skipCommandNameInRoute?: boolean;
    readonly skipQueryNameInRoute?: boolean;
    readonly useProxyFileSuffix?: boolean;
    readonly jsImportSpecifiers?: boolean;
    readonly recordedRules?: ReadonlyMap<string, readonly RecordedRule[]>;
    readonly onDiagnostic?: (message: string) => void;
}
const notice = `/*---------------------------------------------------------------------------------------------
 *  **DO NOT EDIT** - This file is an automatically generated file.
 *--------------------------------------------------------------------------------------------*/\n\n`;
const quote = (value: string): string => `'${value.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n')}'`;
export { quote };
export function filename(name: string, namespace: string, options: SourceRenderOptions): string {
    const segments = namespace.split('.').filter(Boolean).slice(options.segmentsToSkip ?? 0);
    if (segments.some(segment => !/^[A-Za-z][A-Za-z0-9_]*$/.test(segment)) || !/^[A-Za-z][A-Za-z0-9_]*$/.test(name))
        throw new Error(`Unsafe generated name ${namespace}.${name}`);
    return join(...segments, `${name}${options.useProxyFileSuffix ? '.proxy' : ''}.ts`);
}
function moduleFor(source: string, target: string, jsImportSpecifiers = false): string {
    let location = relative(dirname(source), target).replaceAll('\\', '/').replace(/\.ts$/, '');
    if (!location.startsWith('.')) location = './' + location;
    return location + (jsImportSpecifiers ? '.js' : '');
}
export function typeImports(type: SourceType, source: string, destinations: ReadonlyMap<string, string>, options: SourceRenderOptions = {}): string[] {
    if (type.package) return [`import { ${type.text.replace(/\[\]$/, '')} } from '${type.package}';`];
    if (!type.model) return [];
    const destination = destinations.get(type.model);
    if (!destination) throw new Error(`Missing generated model ${type.model}`);
    if (source === destination) return [];
    return [`import { ${type.model} } from '${moduleFor(source, destination, options.jsImportSpecifiers)}';`];
}
export function renderModel(model: SourceModel, path: string, destinations: ReadonlyMap<string, string>, options: SourceRenderOptions = {}): string {
    if (model.kind === 'enum') return `export enum ${model.name} {\n${model.members!.map(member => `    ${member.name} = ${typeof member.value === 'string' ? quote(member.value) : member.value},`).join('\n')}\n}\n`;
    const imports = [...new Set([
        ...model.fields.flatMap(field => typeImports(field.type, path, destinations, options)),
        ...(model.base ? typeImports({ text: model.base, constructor: model.base, model: model.base, enumerable: false, nullable: false, void: false }, path, destinations, options) : [])
    ])].sort();
    if (model.fields.length || model.derivedTypeId) imports.unshift(`import { ${[...(model.fields.length ? ['field'] : []), ...(model.derivedTypeId ? ['derivedType'] : [])].join(', ')} } from '@cratis/fundamentals';`);
    const fields = model.fields.map(field => `    @field(${field.type.constructor}${field.type.enumerable ? ', true' : ''})\n    ${field.name}${field.optional || field.type.nullable ? '?' : '!'}: ${field.type.text};`).join('\n\n');
    return `${imports.join('\n')}${imports.length ? '\n\n' : ''}${model.derivedTypeId ? `@derivedType(${quote(model.derivedTypeId)})\n` : ''}export class ${model.name}${model.base ? ` extends ${model.base}` : ''} {${fields ? `\n${fields}\n` : '\n'}}\n`;
}
export function renderCommand(operation: SourceOperation, path: string, destinations: ReadonlyMap<string, string>, route: string,
    rules: readonly RecordedRule[] = [], diagnostic: (message: string) => void = message => process.stderr.write(`${message}\n`), options: SourceRenderOptions = {}): string {
    const name = operation.name;
    const validation = renderRecordedRules(name, 'CommandValidator', `I${name}`, rules, diagnostic);
    const result = operation.result;
    const imports = [...new Set([result, ...operation.fields.map(field => field.type)].flatMap(type => typeImports(type, path, destinations, options)))].sort();
    const descriptorFields = operation.fields.map(field => `        new PropertyDescriptor(${quote(field.name)}, ${field.type.constructor}, ${field.type.nullable || field.optional}),`).join('\n');
    const fields = operation.fields.map(field => `    private _${field.name}${field.optional || field.type.nullable ? '?' : '!'}: ${field.type.text};`).join('\n');
    const properties = operation.fields.map(field => `    get ${field.name}(): ${field.type.text}${field.optional || field.type.nullable ? ' | undefined' : ''} {\n        return this._${field.name};\n    }\n\n    set ${field.name}(value: ${field.type.text}${field.optional || field.type.nullable ? ' | undefined' : ''}) {\n        this._${field.name} = value;\n        this.propertyChanged(${quote(field.name)});\n    }`).join('\n\n');
    return `import { Command${validation ? ', CommandValidator' : ''} } from '@cratis/arc/commands';\nimport { useCommand, type SetCommandValues, type ClearCommandValues } from '@cratis/arc.react/commands';\nimport { PropertyDescriptor } from '@cratis/arc/reflection';\n${imports.join('\n')}${imports.length ? '\n' : ''}\nexport interface I${name} {\n${operation.fields.map(field => `    ${field.name}?: ${field.type.text};`).join('\n')}\n}\n\n${validation}export class ${name} extends Command<I${name}${result.void ? '' : `, ${result.text}`}> implements I${name} {\n    readonly route: string = ${quote(route)};\n${validation ? `    readonly validation: CommandValidator = new ${name}Validator();\n` : ''}    readonly treatWarningsAsErrors: boolean = false;\n    readonly roles: string[] = [${operation.roles.map(quote).join(', ')}];\n    readonly propertyDescriptors: PropertyDescriptor[] = [\n${descriptorFields}\n    ];\n${fields ? `\n${fields}\n` : ''}\n    constructor() {\n        super(${result.void ? 'Object' : result.constructor}, ${result.enumerable});\n    }\n\n    get requestParameters(): string[] { return []; }\n\n${properties}${properties ? '\n\n' : ''}    static use(initialValues?: I${name}): [${name}, SetCommandValues<I${name}>, ClearCommandValues] {\n        // @ts-ignore: Published React hook infers an incompatible constructor constraint.\n        return useCommand<${name}, I${name}>(${name}, initialValues);\n    }\n}\n`;
}
/** Render analyzer results without importing or executing the application. */
export function renderSource(analysis: SourceAnalysis, options: SourceRenderOptions = {}): ReadonlyMap<string, string> {
    const destinations = new Map<string, string>();
    const diagnostic = options.onDiagnostic ?? (message => process.stderr.write(`${message}\n`));
    for (const message of analysis.diagnostics ?? []) diagnostic(message);
    const files = new Map<string, string>();
    const folded = new Set<string>();
    const add = (path: string, text: string): void => {
        if (folded.has(path.toLowerCase())) throw new Error(`Generated output collision: ${path}`);
        folded.add(path.toLowerCase());
        files.set(path, notice + (text.startsWith('export enum ') ? '' : `/* eslint-disable sort-imports */\n${text.includes('export interface I') ? '/* eslint-disable @typescript-eslint/no-empty-interface */\n' : ''}`) + '// eslint-disable-next-line header/header\n' + text);
    };
    for (const model of analysis.models) {
        if (destinations.has(model.name)) throw new Error(`Ambiguous model name: ${model.name}`);
        destinations.set(model.name, filename(model.name, model.namespace, options));
    }
    for (const model of analysis.models) add(destinations.get(model.name)!, renderModel(model, destinations.get(model.name)!, destinations, options));
    const commands = analysis.operations.filter(operation => operation.kind === 'command');
    const queries = analysis.operations.filter(operation => operation.kind !== 'command');
    for (const operation of analysis.operations) {
        const path = filename(operation.name, operation.namespace, options);
        const peer = operation.kind === 'command' ? commands : queries;
        const route = routeFor({ namespace: operation.namespace, name: operation.name, path: operation.routeOverride }, options.apiPrefix ?? 'api',
            options.segmentsToSkip ?? 0, includeRouteName(operation, peer, options.segmentsToSkip ?? 0,
                operation.kind === 'command' ? !options.skipCommandNameInRoute : !options.skipQueryNameInRoute));
        const ruleKey = [operation.namespace, operation.owner, ...(operation.kind === 'command' ? [] : [operation.name])].filter(Boolean).join('.');
        const rules = options.recordedRules?.get(ruleKey) ?? analysis.recordedRules?.get(ruleKey) ?? [];
        add(path, operation.kind === 'command' ? renderCommand(operation, path, destinations, route, rules, diagnostic, options) :
            renderSourceQuery(operation, path, destinations, route, analysis.models.find(model => model.name === operation.result.model), rules, diagnostic, options));
    }
    return new Map([...files].sort(([first], [second]) => first.localeCompare(second)));
}
