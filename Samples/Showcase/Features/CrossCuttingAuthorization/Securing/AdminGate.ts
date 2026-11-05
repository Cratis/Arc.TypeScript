// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import {
    authorizationCommandFilter, authorizationQueryFilter, unauthorizedCommandResult, unauthorizedQueryResult,
    type AuthorizationCommandFilter, type AuthorizationQueryFilter, type CommandContext, type CommandResult,
    type ExecutionContext, type QueryContext, type QueryResult
} from '@cratis/arc.core';

// Operation names carry the feature namespace when discovered (CrossCuttingAuthorization.Securing.*) and only the
// artifact name when a spec registers artifacts explicitly, so the gate matches the trailing segments.
const securedOperations = ['RunSecuredCommand', 'CrossCuttingStatus.secured'];
const isSecured = (operationName: string | undefined) =>
    securedOperations.some(operation => operationName === operation || operationName?.endsWith(`.${operation}`));
const isAdmin = (context: ExecutionContext) => context.principal?.roles.includes('Admin') === true;

/** One cross-cutting rule: neither the command nor the query declares a role, yet only admins get through. */
@authorizationCommandFilter()
export class AdminCommandGate implements AuthorizationCommandFilter {
    onExecution(context: CommandContext): CommandResult | void {
        if (isSecured(context.operationName) && !isAdmin(context)) {
            return unauthorizedCommandResult(context, 'Only an admin can run secured commands');
        }
    }
}

@authorizationQueryFilter()
export class AdminQueryGate implements AuthorizationQueryFilter {
    onPerform(context: QueryContext): QueryResult | void {
        if (isSecured(context.operationName) && !isAdmin(context)) return unauthorizedQueryResult(context);
    }
}
