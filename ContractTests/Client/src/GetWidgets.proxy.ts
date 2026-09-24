// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { QueryFor } from '@cratis/arc/queries';
import { ParameterDescriptor } from '@cratis/arc/reflection';
import { Widget } from './Widget.proxy.js';
export interface GetWidgetsParameters { term: string }
export class GetWidgets extends QueryFor<Widget[], GetWidgetsParameters> {
    readonly route = '/v1/widgets/search';
    readonly queryName = 'Sales.GetWidgets';
    readonly roles: string[] = ['reader'];
    readonly defaultValue: Widget[] = [];
    readonly parameterDescriptors: ParameterDescriptor[] = [new ParameterDescriptor('term', String, false)];
    term!: string;
    constructor() { super(Widget, true); }
    get requiredRequestParameters(): string[] { return ['term']; }
}
