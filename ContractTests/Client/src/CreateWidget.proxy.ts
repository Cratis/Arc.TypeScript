// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { Command } from '@cratis/arc/commands';
import { PropertyDescriptor } from '@cratis/arc/reflection';
import { Widget } from './Widget.proxy.js';
export interface ICreateWidget { name: string; note?: string }
export class CreateWidget extends Command<ICreateWidget, Widget> implements ICreateWidget {
    readonly route = '/api/sales/create-widget';
    readonly roles: string[] = ['writer'];
    readonly propertyDescriptors: PropertyDescriptor[] = [new PropertyDescriptor('name', String, false), new PropertyDescriptor('note', String, true)];
    name!: string;
    note?: string;
    constructor() { super(Widget, false); }
    get requestParameters(): string[] { return []; }
}
