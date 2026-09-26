// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { reducer } from '@cratis/chronicle/reducers';
import { fromEvent } from '@cratis/chronicle/projections';
import { readModel } from '@cratis/chronicle/readModels';
import { command, commandReadModel, CommandValidator, inject, key, readModelForValidation, validator } from '@cratis/arc.core';
import { ChronicleCommandScenario } from '../../ChronicleCommandScenario.js';
import { AggregateRoot, commandAggregate } from '../../../index.js';

@eventType() class ItemAdded { @field(Number) amount: number; constructor(amount = 0) { this.amount = amount; } }
@eventType() class ItemChecked { @field(Number) amount: number; constructor(amount = 0) { this.amount = amount; } }
@readModel() class ItemState { @field(Number) count = 0; }
@reducer('scenario-item-state', undefined, ItemState)
class ItemReducer {
    itemAdded(event: ItemAdded, current?: ItemState): ItemState { return { count: (current?.count ?? 0) + event.amount }; }
}
@fromEvent(ItemAdded) class ProjectedState { @field(Number) amount = 0; }
@readModel() class UnreducedState { @field(Number) amount = 0; }
@command() class CheckItem {
    @field(String) @key() id = '';
    @inject(commandReadModel(ItemState))
    handle(state: ItemState): ItemChecked { return new ItemChecked(state.count); }
}
@command() class CheckOptionalItem {
    @field(String) @key() id = '';
    @inject(commandReadModel(ItemState, { optional: true }))
    handle(state: ItemState | null): boolean { return state === null; }
}
@command() class CheckProjectedItem {
    @field(String) @key() id = '';
    @inject(commandReadModel(ProjectedState))
    handle(state: ProjectedState): number { return state.amount; }
}
@command() class CheckOptionalProjectedItem {
    @field(String) @key() id = '';
    @inject(commandReadModel(ProjectedState, { optional: true }))
    handle(state: ProjectedState | null): boolean { return state === null; }
}
@command() class CheckUnreducedItem {
    @field(String) @key() id = '';
    @inject(commandReadModel(UnreducedState, { optional: true }))
    handle(state: UnreducedState | null): boolean { return state === null; }
}
@command() class ValidateItem {
    @field(String) @key() id = '';
    @inject(commandReadModel(ItemState))
    provide(state: ItemState): number { return state.count; }
    handle(count: number): boolean { return count > 0; }
}
class ItemAggregate extends AggregateRoot {
    constructor() { super(); this.on(ItemAdded, () => {}); }
    get fresh(): boolean { return this.isNew; }
}
@command() class CheckAggregate {
    @field(String) @key() id = '';
    @inject(commandAggregate(ItemAggregate))
    handle(aggregate: ItemAggregate): boolean { return aggregate.fresh; }
}
@command() class CheckValidatedItem {
    @field(String) @key() id = '';
    @field(Number) count = 0;
    handle(): boolean { return true; }
}
@validator(CheckValidatedItem) class CheckValidatedItemValidator extends CommandValidator<CheckValidatedItem> {
    constructor() {
        super();
        this.ruleFor(command => command.count).mustAsync(async count => {
            const state = await readModelForValidation(ItemState, { optional: true });
            return state?.count === count;
        }).withMessage('Count differs');
    }
}

/** Shared event and command artifacts for the in-memory Chronicle scenario specifications. */
export class a_reduced_command {
    readonly added = ItemAdded;
    readonly checked = ItemChecked;
    readonly state = ItemState;
    readonly check = CheckItem;
    readonly optional = CheckOptionalItem;
    readonly projected = CheckProjectedItem;
    readonly optionalProjected = CheckOptionalProjectedItem;
    readonly unreduced = CheckUnreducedItem;
    readonly validate = ValidateItem;
    readonly validated = CheckValidatedItem;
    readonly aggregate = CheckAggregate;
    create<T extends object>(commandType: new () => T): ChronicleCommandScenario<T> {
        return ChronicleCommandScenario.for(commandType, ItemAdded, ItemChecked, ItemState, ItemReducer,
            ProjectedState, UnreducedState, CheckValidatedItemValidator);
    }
}
