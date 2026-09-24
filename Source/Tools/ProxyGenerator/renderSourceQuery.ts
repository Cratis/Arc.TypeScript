// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryHttpMethod } from '@cratis/arc.core';
import type { SourceModel } from './SourceModel.js';
import type { SourceOperation } from './SourceOperation.js';
import { aliasTypes, queryClassName, quote, typeImports, type SourceRenderOptions } from './renderSource.js';
import { renderRecordedRules } from './renderRecordedRules.js';
import type { RecordedRule } from './RecordedRule.js';

export function renderSourceQuery(operation: SourceOperation, path: string, destinations: ReadonlyMap<string, string>, route: string, modelDefinition?: SourceModel,
    rules: readonly RecordedRule[] = [], diagnostic: (message: string) => void = message => process.stderr.write(`${message}\n`), options: SourceRenderOptions = {}): string {
    const name = queryClassName(operation.name);
    const [resolvedResult, ...fieldTypes] = aliasTypes([operation.result, ...operation.fields.map(field => field.type)], path, destinations, name);
    operation = { ...operation, result: resolvedResult!, fields: operation.fields.map((field, index) => ({ ...field, type: fieldTypes[index]! })) };
    const result = operation.result;
    if (result.void) throw new Error(`Query ${name} cannot return void`);
    const observable = operation.kind === 'observable';
    const array = result.enumerable;
    const model = result.text.replace(/\[\]$/, '');
    const parameterType = operation.fields.length ? `${name}Parameters` : '';
    const validation = renderRecordedRules(name, 'QueryValidator', parameterType || 'object', rules, diagnostic, operation.fields.map(field => field.name));
    const generic = `${result.text}${parameterType ? `, ${parameterType}` : ''}`;
    const base = observable ? 'ObservableQueryFor' : 'QueryFor';
    const imports = [...new Set([result!, ...operation.fields.map(field => field.type)].flatMap(type => typeImports(type, path, destinations, options)))].sort();
    const fields = operation.fields.map(field => `    ${field.name}!: ${field.type.text};`).join('\n');
    const params = operation.fields.length ? `export interface ${parameterType} {\n${operation.fields.map(field => `    ${field.name}${field.optional ? '?' : ''}: ${field.type.text};`).join('\n')}\n}\n\n` : '';
    const request = operation.fields.filter(field => !field.optional).map(field => `            ${quote(field.name)},`).join('\n');
    const descriptors = operation.fields.map(field => `        new ParameterDescriptor(${quote(field.name)}, ${options.emitInterfaces && field.type.model ? 'Object' : field.type.constructor}, ${field.type.enumerable}),`).join('\n');
    const method = observable ? 'Observable' : '';
    const hook = `use${method}Query`;
    const suspense = `useSuspense${method}Query`;
    const tuple = array ? observable ? `, SetSorting` : `, PerformQuery${parameterType ? `<${parameterType}>` : ''}, SetSorting` : observable ? '' : `, PerformQuery${parameterType ? `<${parameterType}>` : ''}, SetSorting`;
    const genericHook = `<${result.text}, ${name}${parameterType ? `, ${parameterType}` : ''}>`;
    const args = parameterType ? `args?: ${parameterType}${array ? ', ' : ''}` : '';
    const sorting = array ? 'sorting?: Sorting' : '';
    const hookArguments = parameterType ? 'args' : 'undefined';
    const callArgs = array ? `, ${hookArguments}, sorting` : parameterType ? ', args' : '';
    const resultTuple = `[QueryResultWithState<${result.text}>${tuple}]`;
    const call = (functionName: string): string => `${functionName}${genericHook}(${name}${callArgs})`;
    const use = (functionName: string, nameSuffix: string): string => `    static ${nameSuffix}(${args}${sorting}): ${resultTuple} {\n        ${observable && !array ? `const [result] = ${call(functionName)};\n        return [result];` : `return ${call(functionName)};`}\n    }`;
    const pageTuple = `[QueryResultWithState<${result.text}>${observable ? '' : ', PerformQuery'}, SetSorting, SetPage, SetPageSize]`;
    const paging = (functionName: string, nameSuffix: string): string => `    static ${nameSuffix}(pageSize: number, ${args}${sorting}): ${pageTuple} {\n        return ${functionName}<${result.text}, ${name}>(${name}, new Paging(0, pageSize), ${hookArguments}, sorting);\n    }`;
    const hooks = [use(hook, 'use'), ...(array ? [paging(`${hook}WithPaging`, 'useWithPaging')] : []), use(suspense, 'useSuspense'),
        ...(array ? [paging(`${suspense}WithPaging`, 'useSuspenseWithPaging')] : [])];
    if (observable && array) hooks.push(`    static useChangeStream(${args}getKey?: (item: ${model}) => unknown, sorting?: Sorting): ChangeSet<${model}> {\n        return useChangeStream<${model}, ${name}${parameterType ? `, ${parameterType}` : ''}>(${name}, ${hookArguments}, getKey, sorting);\n    }`);
    const when = observable ? 'ObservableQueryWhen' : 'QueryWhen';
    hooks.push(`    static when(condition: boolean): ${when}<${name}, ${generic}> {\n        return new ${when}<${name}, ${generic}>(${name}, condition);\n    }`);
    const coreImports = [base, 'QueryResultWithState', ...(validation ? ['QueryValidator'] : []), ...(array ? ['Sorting', 'Paging'] : []),
        ...(array && modelDefinition?.fields.length ? ['SortingActions', observable ? 'SortingActionsForObservableQuery' : 'SortingActionsForQuery'] : []),
        ...(observable && array ? ['ChangeSet'] : []), ...(operation.httpMethod ? ['QueryHttpMethod'] : [])];
    const reactImports = [hook, suspense, ...(array ? [`${hook}WithPaging`, `${suspense}WithPaging`, 'SetPage', 'SetPageSize'] : []),
        ...(observable && array ? ['useChangeStream'] : []), ...(!observable ? ['PerformQuery'] : []),
        ...(array || !observable ? ['SetSorting'] : []), when];
    const sortingMembers = array ? `\n    get sortBy(): ${name}SortBy { return this._sortBy; }\n    static get sortBy(): ${name}SortByWithoutQuery { return this._sortBy; }\n` : '';
    const sortingAction = observable ? 'SortingActionsForObservableQuery' : 'SortingActionsForQuery';
    const sortClasses = array ? `class ${name}SortBy {\n${modelDefinition?.fields.map(field => `    readonly ${field.name}: ${sortingAction}<${result.text}>;`).join('\n') ?? ''}\n    constructor(readonly query: ${name}) {\n${modelDefinition?.fields.map(field => `        this.${field.name} = new ${sortingAction}<${result.text}>(${quote(field.name)}, query);`).join('\n') ?? ''}\n    }\n}\nclass ${name}SortByWithoutQuery {\n${modelDefinition?.fields.map(field => `    readonly ${field.name} = new SortingActions(${quote(field.name)});`).join('\n') ?? ''}\n}\n\n` : '';
    return `import { ${coreImports.map(item => ['QueryResultWithState', 'Sorting', 'ChangeSet'].includes(item) ? `type ${item}` : item).join(', ')} } from '@cratis/arc/queries';\nimport { ${reactImports.map(item => ['SetPage', 'SetPageSize', 'PerformQuery', 'SetSorting'].includes(item) ? `type ${item}` : item).join(', ')} } from '@cratis/arc.react/queries';\nimport { ParameterDescriptor } from '@cratis/arc/reflection';\n${imports.join('\n')}${imports.length ? '\n' : ''}\n${sortClasses}${params}${validation}export class ${name} extends ${base}<${generic}> {\n    readonly route: string = ${quote(route)};\n    readonly queryName: string = ${quote([operation.namespace, operation.owner, operation.name].filter(Boolean).join('.'))};\n${validation ? `    readonly validation: QueryValidator = new ${name}Validator();\n` : ''}    readonly treatWarningsAsErrors: boolean = ${operation.treatWarningsAsErrors ?? false};\n    readonly roles: string[] = [${operation.roles.map(quote).join(', ')}];\n    readonly defaultValue: ${result.text} = ${array ? '[]' : `{} as ${result.text}`};\n${array ? `    private readonly _sortBy: ${name}SortBy;\n    private static readonly _sortBy: ${name}SortByWithoutQuery = new ${name}SortByWithoutQuery();\n` : ''}\n    constructor() {\n        super(${options.emitInterfaces && result.model ? 'Object' : result.constructor}, ${array});${array ? `\n        this._sortBy = new ${name}SortBy(this);` : ''}${operation.httpMethod ? `\n        this.setHttpMethod(QueryHttpMethod.${Object.entries(QueryHttpMethod).find(([, value]) => value === operation.httpMethod)?.[0]});` : ''}\n    }\n\n    get requiredRequestParameters(): string[] {\n        return [\n${request}\n        ];\n    }\n\n    readonly parameterDescriptors: ParameterDescriptor[] = [\n${descriptors}\n    ];\n${fields ? `\n${fields}\n` : ''}${sortingMembers}\n${hooks.join('\n\n')}\n}\n`;
}
