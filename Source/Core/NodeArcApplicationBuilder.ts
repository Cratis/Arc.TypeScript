// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
import { realpath } from 'node:fs/promises';
import { dirname, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ArcApplicationBuilder } from './ArcApplicationBuilder.js';
import { ArcApplication } from './ArcApplication.js';
import { withGeneratedMetadata } from './reflection/registerGeneratedMetadata.js';
import { ensureDiscoveryRootSafe } from './reflection/ensureDiscoveryRootSafe.js';
import { discoveryFiles } from './reflection/discoveryFiles.js';
import type { ClassType } from './reflection/ClassType.js';

/** Node builder adds filesystem discovery to the portable registration pipeline. */
export class NodeArcApplicationBuilder extends ArcApplicationBuilder {
    /** Import decorated artifacts beneath a dedicated discovery root. */
    async discover(root: URL, options: { rootNamespace?: string } = {}): Promise<this> {
        return withGeneratedMetadata(this.generatedMetadata, async () => {
            if (root.protocol !== 'file:') throw new Error('Arc discovery requires a file URL');
            const folder = await realpath(fileURLToPath(root));
            await ensureDiscoveryRootSafe(folder);
            for (const file of discoveryFiles(folder)) {
                const module: Record<string, unknown> = await import(pathToFileURL(file).href);
                const namespace = [options.rootNamespace, ...relative(folder, dirname(file)).split(sep)
                    .filter(value => value && value !== '.')].filter(Boolean).join('.');
                for (const exported of Object.values(module)) {
                    if (typeof exported === 'function') this.register(exported as ClassType, namespace);
                }
            }
            return this;
        });
    }
    /** Build the Node application with standalone listener support. */
    override async build(): Promise<ArcApplication> {
        return new ArcApplication((await super.build()).server);
    }
}
