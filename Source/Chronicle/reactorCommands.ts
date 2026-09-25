// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { isArcCommand, Severity } from '@cratis/arc.core';
import type { ArcServer } from '@cratis/arc.core';
import { causationManager, CausationType } from '@cratis/chronicle/auditing';
import { Identity, identityProvider } from '@cratis/chronicle/identity';
import type { ReactorResultHandler } from '@cratis/chronicle/reactors';

const systemRoles = new WeakMap<object, readonly string[]>();
/** Grant returned commands a system principal with these roles (ordinary reactor commands have no principal). */
export function executeCommandsAsSystem(...roles: string[]): ClassDecorator {
    return target => { systemRoles.set(target, [...roles]); };
}

/** Bind the Arc server once before the Chronicle client begins observing. For caller-owned SDK clients, pass this hook in ChronicleOptions. */
export function reactorCommandResultHandler(server: () => ArcServer, expectedEventStore?: string): ReactorResultHandler {
    return async (value, event, reactor, eventStore, namespace) => {
        if (value === null || value === undefined) return false;
        const commands: unknown[] = Array.isArray(value) ? value : [value];
        if (!commands.length || !commands.some(isArcCommand)) return false;
        if (!commands.every(isArcCommand)) throw new Error('A reactor cannot mix returned Arc commands with events or other values');
        if (expectedEventStore && eventStore !== expectedEventStore)
            throw new Error(`Reactor command event store ${eventStore} does not match Arc event store ${expectedEventStore}`);
        const selected = server();
        const roles = systemRoles.get(reactor);
        const principal = roles ? { id: Identity.system.subject, name: Identity.system.name, roles, isAuthenticated: true } : undefined;
        const run = async () => {
            for (const command of commands) {
                const result = await selected.execute(command, {
                    tenantId: namespace, correlationId: event.correlationId, principal,
                    signal: new AbortController().signal, allowedSeverity: Severity.Warning
                });
                if (!result.isSuccess) throw new Error(`Reactor command ${command.constructor.name} failed in ${eventStore}/${namespace}: ` +
                    [...result.exceptionMessages, ...result.validationResults.map(issue => issue.message),
                        ...!result.isAuthorized ? [result.authorizationFailureReason] : []].join('; '));
            }
        };
        await causationManager.run(new CausationType('ReactorEvent'), {
            eventSourceId: event.eventSourceId, eventType: event.eventType.id.value,
            sequenceNumber: event.sequenceNumber.toString(), eventStore, namespace
        }, () => identityProvider.run(roles ? Identity.system : event.causedBy ?? Identity.system, run));
        return true;
    };
}
