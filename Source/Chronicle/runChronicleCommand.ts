// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { causationManager, CausationType } from '@cratis/chronicle/auditing';
import { CorrelationId, correlationIdManager } from '@cratis/chronicle/correlation';
import { Identity, identityProvider } from '@cratis/chronicle/identity';
import { getPIIMetadata, getTypePIIMetadata } from '@cratis/chronicle/compliance';
import type { CommandContext, CommandResult } from '@cratis/arc.core';
import { notAuditedFields } from './notAudited.js';

/** Isolate Chronicle's ambient audit identity and causation around a full command execution. */
export function runChronicleCommand(context: CommandContext, execute: () => Promise<CommandResult>): Promise<CommandResult> {
    const command = context.command;
    const properties: Record<string, string> = { Command: command && typeof command === 'object' ? command.constructor.name : 'Unknown' };
    if (command && typeof command === 'object' && !getTypePIIMetadata(command.constructor)) {
        for (const [name, value] of Object.entries(command)) {
            if (name === '__proto__' || name === 'constructor' || name === 'prototype' ||
                notAuditedFields(command.constructor).has(name) || getPIIMetadata(command, name) ||
                /password|secret|token|credential|apiKey/i.test(name)) continue;
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
                properties[`Value.${name}`] = String(value).slice(0, 1024);
        }
    }
    const principal = context.principal;
    const identity = principal?.isAuthenticated ? new Identity(principal.id, principal.name ?? principal.id) : Identity.system;
    return identityProvider.run(identity, () => correlationIdManager.run(new CorrelationId(context.correlationId), () =>
        causationManager.run(new CausationType('Arc.Command'), properties, execute)));
}
