// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { ArcApplication, command, injectable, inject, query, readModel } from '@cratis/arc.core';

class ValueProvider { readonly value = 'inferred'; }
@injectable()
class Consumer {
    constructor(readonly provider: ValueProvider) {}
}
@command()
class CheckCommand {
    @inject()
    handle(provider: ValueProvider): string { return provider.value; }
}
@readModel()
class CheckModel {
    @query()
    static check(provider: ValueProvider): string { return provider.value; }
}
const builder = ArcApplication.createBuilder();
builder.services.addSingleton(ValueProvider).addTransient(Consumer);
builder.add(CheckCommand, CheckModel);
export const application = await builder.build();
export async function consumerValue(): Promise<string> {
    const scope = application.server.services.createScope({
        correlationId: 'legacy', principal: undefined, tenantId: undefined, signal: new AbortController().signal, allowedSeverity: 2
    });
    try { return (await scope.resolve(Consumer)).provider.value; }
    finally { await scope.dispose(); }
}
