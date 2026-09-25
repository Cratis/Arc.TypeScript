// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Constructor } from '@cratis/fundamentals';
import { getReadModelMetadata } from '@cratis/chronicle/readModels';
import { JsonSchemaGenerator } from '@cratis/chronicle/schemas';
import type { JsonSchema } from '@cratis/chronicle/schemas';
import { getReducerMetadata } from '@cratis/chronicle/reducers';
import type { ChronicleArtifacts } from './ChronicleArtifacts.js';

function containsCompliance(schema: JsonSchema): boolean {
    return !!schema.compliance?.length || !!schema.items && containsCompliance(schema.items) ||
        Object.values(schema.properties ?? {}).some(containsCompliance);
}

/** Restrict Arc release to Chronicle projections: the SDK already releases reducer reads. */
export function hasProjectedCompliance(type: Constructor, artifacts: ChronicleArtifacts): boolean {
    if (!artifacts.readModels.includes(type) || artifacts.reducers.some(reducer => getReducerMetadata(reducer)?.readModel === type)) return false;
    const schema = getReadModelMetadata(type)?.schema ?? JsonSchemaGenerator.generate(type);
    return containsCompliance(schema);
}
