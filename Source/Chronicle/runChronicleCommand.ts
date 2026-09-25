// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { causationManager, CausationType } from '@cratis/chronicle/auditing';
import { CorrelationId, correlationIdManager } from '@cratis/chronicle/correlation';
import { Identity, identityProvider } from '@cratis/chronicle/identity';
import { getPIIMetadata, getTypePIIMetadata } from '@cratis/chronicle/compliance';
import { ConceptAs, Guid, DateOnly, TimeOnly, TimeSpan } from '@cratis/fundamentals';
import type { CommandContext, CommandResult } from '@cratis/arc.core';
import { notAuditedFields } from './notAudited.js';
import { ChronicleUnitOfWork } from './ChronicleUnitOfWork.js';

/** Isolate Chronicle's ambient audit identity and causation around a full command execution. */
export function runChronicleCommand(context: CommandContext, execute: () => Promise<CommandResult>): Promise<CommandResult> {
    const command = context.command;
    const properties: Record<string, string> = { Command: command && typeof command === 'object' ? command.constructor.name : 'Unknown' };
    if (command && typeof command === 'object' && !getTypePIIMetadata(command.constructor)) {
        for (const [name, value] of Object.entries(command)) {
            if (name === '__proto__' || name === 'constructor' || name === 'prototype' ||
                notAuditedFields(command.constructor).has(name) || getPIIMetadata(command, name) ||
                (value !== null && typeof value === 'object' && getTypePIIMetadata(value.constructor)) ||
                /password|secret|token|credential|apiKey/i.test(name)) continue;
            const primitive: unknown = value instanceof ConceptAs ? value.value : value;
            if (typeof primitive === 'string' || typeof primitive === 'number' || typeof primitive === 'boolean' ||
                typeof primitive === 'bigint' || primitive instanceof Guid || primitive instanceof Date ||
                primitive instanceof DateOnly || primitive instanceof TimeOnly || primitive instanceof TimeSpan)
                properties[`Value.${name}`] = (primitive instanceof Date ? primitive.toISOString() : String(primitive)).slice(0, 1024);
        }
    }
    const principal = context.principal;
    const identity = principal?.isAuthenticated ? new Identity(principal.id, principal.name ?? principal.id) : Identity.system;
    const outer = ChronicleUnitOfWork.active();
    const unit = outer ?? new ChronicleUnitOfWork(context);
    return ChronicleUnitOfWork.run(unit, () => identityProvider.run(identity, () =>
        correlationIdManager.run(new CorrelationId(context.correlationId), () =>
            causationManager.run(new CausationType('Arc.Command'), properties, async () => {
                const result = await execute();
                return outer ? unit.nestedCompleted(result) : result;
            }))));
}
