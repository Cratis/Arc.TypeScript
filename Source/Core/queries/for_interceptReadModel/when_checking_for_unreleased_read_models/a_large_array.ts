// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { given } from '../../../given.js';
import { assertNoUnreleasedReadModels } from '../../interceptReadModel.js';
import { raw_documents } from '../given/raw_documents.js';

describe('when checking results holding very large arrays', given(raw_documents, context => {
    const interceptor = () => ({ ...context.interceptor, isReleased: () => false });
    it('should accept a large top-level array', () =>
        (() => assertNoUnreleasedReadModels(Array.from({ length: 250_000 }, (_, id) => ({ id })), [interceptor()])).should.not.throw());
    it('should accept a large nested array', () =>
        (() => assertNoUnreleasedReadModels({ series: { points: new Array(300_000).fill(1) } }, [interceptor()])).should.not.throw());
    it('should accept a large typed array', () =>
        (() => assertNoUnreleasedReadModels({ samples: new Float64Array(300_000) }, [interceptor()])).should.not.throw());
    it('should still find a raw document deep in a large array', () => {
        const items: unknown[] = new Array(250_000).fill(0);
        items[200_000] = { deep: [context.document()] };
        (() => assertNoUnreleasedReadModels({ items }, [interceptor()])).should.throw('nested or projected raw documents');
    });
}));
