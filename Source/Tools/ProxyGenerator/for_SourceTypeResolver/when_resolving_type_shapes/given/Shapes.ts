// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';

export enum Status { Open = 'open', Closed = 'closed' }
export enum Priority { Low, High }

export class Shapes {
    text!: string | null;
    optionalVoid!: string | void;
    flag!: true | false;
    choice!: 'first' | 'second';
    choices!: ('first' | 'second')[] | null;
    status!: Status;
    priority!: Priority;
    promised!: Promise<string | null>;
    promiseLike!: PromiseLike<number>;
    date!: Date;
    empty!: void;
    mixed!: string | number;
    nested!: string[][];
    nullableElements!: (string | null)[];
    voidElements!: void[];
    tuple!: [string, number];
    unknownValue!: unknown;
}

export class InferredFields {
    @field(String) question?: string;
    @field(String) initialized = 'value';
    @field(String) nullable!: string | null;
    ignored!: string;
}

export class RecursiveModel {
    @field(Object) next!: RecursiveModel;
}
