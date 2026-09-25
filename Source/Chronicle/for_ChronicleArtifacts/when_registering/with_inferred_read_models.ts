// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { field } from '@cratis/fundamentals';
import { fromEvent, setFrom, projection } from '@cratis/chronicle/projections';
import { reducer } from '@cratis/chronicle/reducers';
import { eventType } from '@cratis/chronicle/events';
import { ChronicleArtifacts } from '../../ChronicleArtifacts.js';
import { given } from '@cratis/arc.testing';

@eventType('ArcInferredReadModelEvent')
class Registered { @field(String) name = ''; }
@fromEvent(Registered)
class FromEventModel { @field(String) name = ''; }
class PropertyModel { @field(String) @setFrom(Registered) name = ''; }
class ProjectionModel { @field(String) name = ''; }
class ReducerModel { @field(String) name = ''; }
@projection('ArcInferredProjection', ProjectionModel)
class ProjectNames {}
@reducer('ArcInferredReducer', undefined, ReducerModel)
class ReduceNames {}
class Unrelated { @field(String) name = ''; }

class a_catalog { readonly catalog = new ChronicleArtifacts(); }

describe('when registering inferred read models', given(a_catalog, context => {
    beforeEach(() => {
        context.catalog.register(FromEventModel);
        context.catalog.register(PropertyModel);
        context.catalog.register(ProjectNames);
        context.catalog.register(ReduceNames);
        context.catalog.register(Unrelated);
    });
    it('should include model-bound read models without the deprecated Chronicle decorator', () => {
        context.catalog.readModels.should.include(FromEventModel).and.include(PropertyModel);
    });
    it('should infer read models owned by registered projections and reducers', () => {
        context.catalog.readModels.should.include(ProjectionModel).and.include(ReducerModel);
    });
    it('should not register unrelated types', () => {
        context.catalog.readModels.should.not.include(Unrelated);
    });
}));
