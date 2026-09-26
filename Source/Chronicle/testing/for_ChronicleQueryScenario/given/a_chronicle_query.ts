// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { reducer } from '@cratis/chronicle/reducers';
import { fromEvent } from '@cratis/chronicle/projections';
import { readModel as chronicleReadModel } from '@cratis/chronicle/readModels';
import { argument, query, readModel, service } from '@cratis/arc.core';
import { ChronicleReadModels } from '../../../ChronicleReadModels.js';
import { ChronicleQueryScenario } from '../../ChronicleQueryScenario.js';

@eventType() export class BalanceChanged { @field(Number) amount: number; constructor(amount = 0) { this.amount = amount; } }
@chronicleReadModel() export class Balance { @field(Number) amount = 0; }
@reducer('query-balance-reducer', undefined, Balance)
export class BalanceReducer {
    balanceChanged(event: BalanceChanged, current?: Balance): Balance { return { amount: (current?.amount ?? 0) + event.amount }; }
}
@fromEvent(BalanceChanged) export class ProjectedBalance { @field(Number) amount = 0; }
@chronicleReadModel() export class OtherBalance { @field(Number) amount = 0; }
@readModel() export class BalanceQueries {
    @query(argument('id', String), service(ChronicleReadModels))
    static async byId(id: string, models: ChronicleReadModels): Promise<Balance | null> { return models.getById(Balance, id); }
    @query(argument('id', String), service(ChronicleReadModels))
    static async other(id: string, models: ChronicleReadModels): Promise<OtherBalance | null> { return models.findInstanceById(OtherBalance, id); }
    @query(argument('id', String), service(ChronicleReadModels))
    static async projected(id: string, models: ChronicleReadModels): Promise<ProjectedBalance | null> { return models.getById(ProjectedBalance, id); }
    @query(service(ChronicleReadModels))
    static async all(models: ChronicleReadModels): Promise<Balance[]> { return models.getAll(Balance); }
    @query(service(ChronicleReadModels))
    static async watch(models: ChronicleReadModels) { return (await models.getStore()).readModels.watch(Balance); }
    @query({ observable: true }, service(ChronicleReadModels))
    static stream(models: ChronicleReadModels) { return models.observeAll(Balance); }
}
export class a_chronicle_query {
    create<T = unknown>(method: string): ChronicleQueryScenario<T> {
        return ChronicleQueryScenario.for<T>(BalanceQueries, method, Balance, BalanceChanged, BalanceReducer, OtherBalance, ProjectedBalance);
    }
}
