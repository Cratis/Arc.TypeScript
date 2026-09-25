// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
(Symbol as unknown as { metadata: symbol }).metadata ??= Symbol.for('Symbol.metadata');
export { ArcServer, currentContext } from './ArcServer.js';
export { FetchArcApplication as ArcApplication } from './FetchArcApplication.js';
export { ArcApplicationBuilder } from './ArcApplicationBuilder.js';
export type { ArcBuilderIntegrationOptions } from './ArcBuilderIntegrationOptions.js';
export { canonicalMetadataSignature } from './reflection/generatedMetadataSignature.js';
export { optionalService } from './reflection/optionalService.js';
export type { GeneratedMetadata, GeneratedArtifactMetadata } from './reflection/GeneratedArtifactMetadata.js';
/** Convert model-bound values to the same JSON-ready shape as Arc's HTTP pipeline. */
export { encode as encodeWireValue } from './reflection/wireSchema.js';
export { ArcApplicationServices } from './ArcApplicationServices.js';
export { key } from './reflection/key.js';
export { fieldsFor, wireName } from './reflection/wireSchema.js';
export type { ClassType } from './reflection/ClassType.js';
export type { WireField } from './reflection/WireField.js';
export { optional } from './reflection/optional.js';
export { nullable } from './reflection/nullable.js';
export { defaultValue } from './reflection/defaultValue.js';
export { enumeration } from './reflection/enumeration.js';
export type { ArcOptions } from './ArcOptions.js';
export type { DescriptorBase } from './DescriptorBase.js';
export * from './commands/index.js';
export * from './queries/index.js';
export * from './validation/index.js';
export * from './authorization/index.js';
export * from './authentication/index.js';
export * from './identity/index.js';
export * from './tenancy/index.js';
export * from './execution/index.js';
export * from './dependencyInjection/index.js';
export { routeFor, includeRouteName } from './http/createRouteTable.js';
export type { NativeRequestContext } from './http/NativeRequestContext.js';
export type { Operation } from './http/Operation.js';
export * from './introspection/index.js';
export * from './results/index.js';
