// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { projection, type IProjectionBuilderFor } from '@cratis/chronicle/projections';
import { readModel as chronicleReadModel } from '@cratis/chronicle/readModels';
import { argument, command, commandReadModel, inject, key, query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '../../ChronicleReadModels.js';

@eventType() export class InferredAmountChanged {
    @field(Number) amount: number;
    constructor(amount = 0) { this.amount = amount; }
}
@chronicleReadModel() export class InferredAmount { @field(String) id = ''; @field(Number) amount = 0; }
@chronicleReadModel() export class UnbackedName { @field(String) id = ''; @field(String) name = ''; }
@projection('ArcScenarioInferredAmount')
export class InferredAmountProjection {
    define(builder: IProjectionBuilderFor<InferredAmount>): void {
        builder.from(InferredAmountChanged, from => from.set(model => model.amount).to(event => event.amount));
    }
}
@command() export class CheckInferredAmount {
    @field(String) @key() id = '';
    @inject(commandReadModel(InferredAmount))
    handle(amount: InferredAmount): number { return amount.amount; }
}
@readModel() export class InferredAmountQueries {
    @query(argument('id', String), service(ChronicleReadModels))
    static async byId(id: string, models: ChronicleReadModels): Promise<InferredAmount | null> {
        return models.getById(InferredAmount, id);
    }
    @query(argument('id', String), service(ChronicleReadModels))
    static async unbacked(id: string, models: ChronicleReadModels): Promise<UnbackedName | null> {
        return models.findInstanceById(UnbackedName, id);
    }
}
