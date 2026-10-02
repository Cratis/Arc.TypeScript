// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import sinon from 'sinon';
import { ArcApplication, command, commandReadModel, CommandValidator, inject, key, Severity, validator } from '../../../index.js';
import type { CommandContext } from '../../../commands/CommandContext.js';
import type { ReadModelForCommandResolver } from '../../../commands/ReadModelForCommandResolver.js';
import type { ExecutionContext } from '../../../execution/ExecutionContext.js';
import type { ClassType } from '../../../reflection/ClassType.js';
import type { ServiceScope } from '../../../dependencyInjection/ServiceScope.js';
import { readModelForValidation } from '../../readModelForValidation.js';

export class State { constructor(public name = 'old') {} }
export class StateResolver implements ReadModelForCommandResolver {
    lookup = sinon.stub().resolves(new State());
    supports(type: ClassType): boolean { return type === State; }
    async find<T>(type: ClassType<T>, key: string, context: CommandContext): Promise<T | null> {
        return await this.lookup(type, key, context) as T | null;
    }
}
export class ValidationProbe {
    constructed = 0;
    allowMissing = false;
    validated: (State | null)[] = [];
    prepared: State[] = [];
    handled: State[] = [];
}
@command()
export class ChangeState {
    @field(String) @key() id = '';
    @field(String) name = '';
    @inject(commandReadModel(State), ValidationProbe)
    provide(state: State, probe: ValidationProbe): State { probe.prepared.push(state); return state; }
    @inject(commandReadModel(State), ValidationProbe)
    handle(prepared: State, state: State, probe: ValidationProbe): boolean {
        probe.handled.push(state);
        return prepared === state;
    }
}
@validator(ChangeState)
export class ChangeStateValidator extends CommandValidator<ChangeState> {
    static inject = [ValidationProbe] as const;
    constructor(probe: ValidationProbe) {
        super();
        probe.constructed++;
        this.ruleFor(command => command.name).mustAsync(async name => {
            const state = await readModelForValidation(State, { optional: true });
            probe.validated.push(state);
            return state === null ? probe.allowMissing : state.name !== name;
        }).withMessage('State must exist and have a different name');
    }
}
@command()
export class RequireState {
    @field(String) @key() id = '';
    @inject(ValidationProbe)
    handle(probe: ValidationProbe): void { probe.handled.push(new State()); }
}
@validator(RequireState)
export class RequireStateValidator extends CommandValidator<RequireState> {
    constructor() {
        super();
        this.ruleFor(command => command.id).mustAsync(async () => (await readModelForValidation(State)).name !== '')
            .withMessage('State has no name');
    }
}
export function executionContext(tenantId = 'tenant-a', correlationId = 'command-1', signal = new AbortController().signal): ExecutionContext {
    return { tenantId, correlationId, signal, principal: undefined, allowedSeverity: Severity.Warning };
}
export function validationRequest(name = 'ChangeState', validate = false): Request {
    const path = name === 'ChangeState' ? 'change-state' : 'require-state';
    return new Request(`http://localhost/api/${path}${validate ? '/validate' : ''}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: 'state-1', name: 'old' })
    });
}
export class a_command_with_validation_state {
    resolver = new StateResolver();
    probe = new ValidationProbe();
    logged: unknown[] = [];
    builder = ArcApplication.createBuilder({ configuration: false, development: true, environmentName: 'Development',
        logger: error => { this.logged.push(error); } });
    constructor(probeFactory?: (scope: ServiceScope) => ValidationProbe) {
        this.builder.services.addSingleton(StateResolver, () => this.resolver);
        if (probeFactory) this.builder.services.addScoped(ValidationProbe, probeFactory);
        else this.builder.services.addSingleton(ValidationProbe, () => this.probe);
        this.builder.addReadModelForCommandResolver(StateResolver);
        this.builder.add(ChangeState, ChangeStateValidator, RequireState, RequireStateValidator);
    }
}
