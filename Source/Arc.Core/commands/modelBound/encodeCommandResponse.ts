// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { isArcTuple } from '../../results/ArcTuple.js';
import { tuple } from '../../results/tuple.js';
import { isOutcome, response } from '../../results/Outcome.js';
import { encode } from '../../reflection/wireSchema.js';
import { CommandOperation } from '../CommandOperationDeclaration.js';
import { isCommandOperations } from '../CommandOperations.js';
/** Preserve server-only declarations and branded return branches until the pipeline classifies them. */
export function encodeCommandResponse(value: unknown): unknown {
    if (isArcTuple(value)) return tuple(...value.values.map(encodeCommandResponse));
    if (isOutcome(value)) return value.kind === 'response' ? response(encodeCommandResponse(value.value)) : value;
    if (value instanceof CommandOperation || isCommandOperations(value)) return value;
    return encode(value);
}
