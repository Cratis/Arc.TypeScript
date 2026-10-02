// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { argument, command, CommandValidator, query, readModel, validator, type ObservableSource } from '@cratis/arc.core';
import { derivedType, field, Guid } from '@cratis/fundamentals';

export enum Status {
    Draft = 0,
    Published = 1
}

export class Detail {
    @field(Guid) id!: Guid;
    @field(Date) created!: Date;
}

export interface INotice {
    title: string;
}

export class Notice implements INotice {
    @field(String) title!: string;
}

@derivedType('1578f20a-cd63-456f-98aa-c97daf05d0fa')
export class UrgentNotice extends Notice {
    @field(Number) priority!: number;
}

@command({ namespace: 'ProxyComparison' })
export class Register {
    @field(Guid) id!: Guid;
    @field(String) name!: string;
    @field(Number) quantity!: number;

    handle(): void { }
}

@validator(Register)
export class RegisterValidator extends CommandValidator<Register> {
    constructor() {
        super();
        this.ruleFor(command => command.name).notEmpty().withMessage('Name required');
        this.ruleFor(command => command.name).maxLength(40).withMessage('Name too long');
        this.ruleFor(command => command.quantity).greaterThanOrEqual(1).withMessage('Quantity must be positive');
    }
}

@readModel({ namespace: 'ProxyComparison' })
export class Listing {
    @field(String) name!: string;
    @field(Detail) detail!: Detail;
    @field(Notice, false, [UrgentNotice]) notice!: Notice;
    @field(Number) status!: Status;

    @query(argument('id', Guid))
    static All(id: Guid): Listing[] { void id; return []; }

    @query({ observable: true }, argument('id', Guid))
    static Observe(id: Guid): ObservableSource<Listing[]> { void id; throw new Error('Generation-only fixture'); }
}
