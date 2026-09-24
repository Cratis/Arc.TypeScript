// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import type { Observable, Subject, BehaviorSubject, ReplaySubject } from 'rxjs';

export declare function observable(): Observable<string>;
export declare function subject(): Subject<string>;
export declare function behavior(): BehaviorSubject<string>;
export declare function replay(): ReplaySubject<string>;
