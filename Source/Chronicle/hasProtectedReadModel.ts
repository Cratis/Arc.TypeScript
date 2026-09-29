// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Constructor } from '@cratis/fundamentals';
import { getReadModelMetadata } from '@cratis/chronicle/readModels';
import { JsonSchemaGenerator } from '@cratis/chronicle/schemas';
import type { JsonSchema } from '@cratis/chronicle/schemas';

const protectedTypes = new WeakMap<Constructor, boolean>();
const topLevelComplianceTypes = new WeakMap<Constructor, boolean>();

function schemaFor(type: Constructor): JsonSchema {
    return getReadModelMetadata(type)?.schema ?? JsonSchemaGenerator.generate(type);
}

function containsProtection(schema: JsonSchema): boolean {
    return !!schema.compliance?.length || !!schema.security?.length ||
        !!schema.items && containsProtection(schema.items) ||
        Object.values(schema.properties ?? {}).some(containsProtection);
}

/** Cache whether a Chronicle read model carries compliance or encryption metadata at any depth. */
export function hasProtectedReadModel(type: Constructor): boolean {
    let protectedModel = protectedTypes.get(type);
    if (protectedModel === undefined) {
        protectedModel = containsProtection(schemaFor(type));
        protectedTypes.set(type, protectedModel);
    }
    return protectedModel;
}

/**
 * Whether a model has compliance metadata on a top-level property: the only case in which the Chronicle SDK
 * releases reducer-model reads itself (its `schemaHasComplianceMetadata`).
 */
export function hasTopLevelCompliance(type: Constructor): boolean {
    let result = topLevelComplianceTypes.get(type);
    if (result === undefined) {
        result = Object.values(schemaFor(type).properties ?? {}).some(property => !!property.compliance?.length);
        topLevelComplianceTypes.set(type, result);
    }
    return result;
}
