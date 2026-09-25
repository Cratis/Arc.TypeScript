// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { pii, subject } from '@cratis/chronicle/compliance';
import { fromEvent } from '@cratis/chronicle/projections';
import { argument, query, readModel, service } from '@cratis/arc.core';
import type { Observable } from 'rxjs';
import { ChronicleReadModels } from '../ChronicleReadModels.js';
import { PrivateLiveCreated } from './PrivateLiveCreated.js';

/** Project encrypted personal data, keyed by its compliance subject. */
@readModel()
@fromEvent(PrivateLiveCreated)
export class PrivateLiveView {
    static readonly readModelId = 'ArcTypeScriptPrivateLiveView';
    @field(String) @subject() id = '';
    @field(String) @pii() name = '';

    @query(argument('id', String), service(ChronicleReadModels))
    static byPrivateId(id: string, models: ChronicleReadModels): Promise<PrivateLiveView | null> {
        return models.findInstanceById(PrivateLiveView, id);
    }

    @query({ observable: true }, argument('id', String), service(ChronicleReadModels))
    static watchPrivateId(id: string, models: ChronicleReadModels): Observable<PrivateLiveView | null> {
        return models.observeById(PrivateLiveView, id);
    }
}
