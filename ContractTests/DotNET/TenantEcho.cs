// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Arc.Tenancy;
using Microsoft.AspNetCore.Mvc;

namespace HttpFixture;

/// <summary>A tenant-scoped query that returns the tenant selected by Arc.</summary>
/// <param name="TenantId">The tenant selected for the query.</param>
[ReadModel]
public record TenantEcho(string TenantId)
{
    /// <summary>Echoes the selected tenant from the current query scope.</summary>
    /// <param name="tenant">The current tenant accessor.</param>
    /// <returns>The selected tenant.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/tenant-echo")]
    public static TenantEcho Current([FromServices] ITenantIdAccessor tenant) => new(tenant.Current.Value);
}
