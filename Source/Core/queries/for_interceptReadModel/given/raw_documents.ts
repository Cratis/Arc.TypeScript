// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import sinon from 'sinon';
import { Severity } from '../../../validation/Severity.js';
import type { ExecutionContext } from '../../../execution/ExecutionContext.js';
import type { ReadModelInterceptor } from '../../ReadModelInterceptor.js';
import { markRawReadModelDocument } from '../../rawReadModelDocuments.js';

export class Person { name = ''; }
export class Other { name = ''; }

export class raw_documents {
    readonly context: ExecutionContext = { tenantId: 'tenant-a', correlationId: crypto.randomUUID(), principal: undefined,
        signal: new AbortController().signal, allowedSeverity: Severity.Warning };
    readonly transformed = { name: 'plain' };
    readonly intercept = sinon.stub().callsFake(async (model: object) => model);
    readonly interceptRawDocument = sinon.stub().callsFake(async () => this.transformed);
    readonly interceptor: ReadModelInterceptor = { model: Person, intercept: this.intercept, interceptRawDocument: this.interceptRawDocument };
    document(model: new () => object = Person, tenantId = 'tenant-a'): object {
        return markRawReadModelDocument({ _id: 'subject-1', name: 'ciphertext' }, { model, tenantId, subject: 'subject-1' });
    }
}
