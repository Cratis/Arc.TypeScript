// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { command } from '@cratis/arc.core';

interface ReportSink { write(): void }
@command()
export class WriteReport {
    handle(sink: ReportSink): void { sink.write(); }
}
