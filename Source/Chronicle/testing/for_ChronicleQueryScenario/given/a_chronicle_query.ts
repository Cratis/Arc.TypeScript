// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { eventType } from '@cratis/chronicle/events';
import { reducer } from '@cratis/chronicle/reducers';
import { fromEvent, increment, setFromContext } from '@cratis/chronicle/projections';
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
@fromEvent(BalanceChanged) export class ProjectedBalance { @field(String) id = ''; @field(Number) amount = 0; }
@fromEvent(BalanceChanged) export class SequencedBalance {
    @field(String) id = '';
    @field(String) @setFromContext(BalanceChanged, 'sequenceNumber') sequence = '';
}
@fromEvent(BalanceChanged) export class UnsupportedBalance {
    @field(String) id = '';
    @field(Number) @increment(BalanceChanged) count = 0;
}
@reducer('query-projection-precedence', undefined, ProjectedBalance)
export class ProjectionPrecedenceReducer {
    balanceChanged(event: BalanceChanged, current?: ProjectedBalance): ProjectedBalance {
        return { id: '', amount: (current?.amount ?? 0) + event.amount * 2 };
    }
}
@chronicleReadModel() export class OtherBalance { @field(Number) amount = 0; }
@readModel() export class BalanceQueries {
    @query(argument('id', String), service(ChronicleReadModels))
    static async byId(id: string, models: ChronicleReadModels): Promise<Balance | null> { return models.getById(Balance, id); }
    @query(argument('id', String), service(ChronicleReadModels))
    static async other(id: string, models: ChronicleReadModels): Promise<OtherBalance | null> { return models.findInstanceById(OtherBalance, id); }
    @query(argument('id', String), service(ChronicleReadModels))
    static async projected(id: string, models: ChronicleReadModels): Promise<ProjectedBalance | null> { return models.getById(ProjectedBalance, id); }
    @query(argument('id', String), service(ChronicleReadModels))
    static async unsupported(id: string, models: ChronicleReadModels): Promise<UnsupportedBalance | null> {
        return models.getById(UnsupportedBalance, id);
    }
    @query(argument('id', String), service(ChronicleReadModels))
    static async sequenced(id: string, models: ChronicleReadModels): Promise<SequencedBalance | null> {
        return models.getById(SequencedBalance, id);
    }
    @query(service(ChronicleReadModels))
    static async all(models: ChronicleReadModels): Promise<Balance[]> { return models.getAll(Balance); }
    @query(service(ChronicleReadModels))
    static async watch(models: ChronicleReadModels) { return (await models.getStore()).readModels.watch(Balance); }
    @query({ observable: true }, service(ChronicleReadModels))
    static stream(models: ChronicleReadModels) { return models.observeAll(Balance); }
}
export class a_chronicle_query {
    create<T = unknown>(method: string, ...artifacts: (new () => object)[]): ChronicleQueryScenario<T> {
        return ChronicleQueryScenario.for<T>(BalanceQueries, method, Balance, BalanceChanged, BalanceReducer, OtherBalance, ProjectedBalance,
            SequencedBalance, UnsupportedBalance, ...artifacts);
    }
}
