// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { fieldsFor } from './wireSchema.js';
import { ownMetadata, type ClassType, type WireType } from './metadata.js';

/** Refuse decorators on declarations that would not affect an endpoint. */
export function validateMetadata(type: ClassType): void {
    const metadata = ownMetadata(type);
    const queryNames = metadata.readModel ? new Set(metadata.queryMethods?.keys()) : new Set<string>();
    const validCommand = metadata.command && !metadata.readModel;
    if (metadata.command && metadata.readModel) throw new Error(`Conflicting Arc artifact: ${type.name}`);
    if (metadata.lifetime && (metadata.command || metadata.readModel)) {
        throw new Error(`Service lifetime on ${type.name} has no effect on a model-bound artifact`);
    }
    if (metadata.constructorTokens && (metadata.command || metadata.readModel)) {
        throw new Error(`@injectable on ${type.name} has no effect on a model-bound artifact`);
    }
    if (metadata.readModel && (metadata.path || metadata.authorization) && !metadata.queryMethods?.size) {
        throw new Error(`Read model ${type.name} has no query for its class decorators`);
    }
    if (metadata.queryMethods?.size && !metadata.readModel) throw new Error(`@query requires @readModel: ${type.name}`);
    for (const name of metadata.methodAuthorization?.keys() ?? []) {
        if (!queryNames.has(name)) throw new Error(`Authorization on ${type.name}.${name} requires @query`);
    }
    for (const name of metadata.methodRoutes?.keys() ?? []) {
        if (!queryNames.has(name)) throw new Error(`@path on ${type.name}.${name} requires @query`);
    }
    for (const name of metadata.injected?.keys() ?? []) {
        if (!validCommand || name !== 'handle') throw new Error(`@inject on ${type.name}.${name} requires a command handle()`);
    }
    if (metadata.path && !validCommand && !metadata.readModel) throw new Error(`@path requires @command or @readModel: ${type.name}`);
    if (metadata.authorization && !validCommand && !metadata.readModel) {
        throw new Error(`Authorization requires @command or @readModel: ${type.name}`);
    }
    if (metadata.fieldOptions?.size) {
        const fields = new Set(fieldsFor(type as WireType).map(field => field.name));
        for (const name of metadata.fieldOptions.keys()) {
            if (!fields.has(name)) throw new Error(`Field annotation on ${type.name}.${name} requires @field`);
        }
    }
}
