// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Observable, Subject } from 'rxjs';
import type { DrizzleObservable } from '../../../../Drizzle/DrizzleObservable.js';
import type { MongoObservable } from '../../../../MongoDB/MongoObservable.js';

export declare function drizzle(): DrizzleObservable<string[]>;
export declare function mongo(): MongoObservable<string[]>;
export declare function annotated(): Observable<string[]>;
export declare function subject(): Subject<string[]>;

class Mid<T> extends Observable<T> {}
class Leaf<U> extends Mid<U> {}
class Wrap<T> extends Observable<T[]> {}

export declare function leaf(): Leaf<string[]>;
export declare function wrapped(): Wrap<string>;
