// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { query, readModel, service } from '@cratis/arc.core';
import { drizzleReadModel } from '../../../drizzleToken.js';
import type { DrizzleReadModels } from '../../../DrizzleReadModels.js';
import { StreamTask } from './StreamTask.js';

@readModel()
export class StreamTasks {
    @query({ observable: true }, service(drizzleReadModel(StreamTask)))
    static all(models: DrizzleReadModels<StreamTask>) { return models.observe(); }
}
