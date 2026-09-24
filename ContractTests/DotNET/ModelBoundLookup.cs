// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
using Cratis.Arc.Authorization;
using Cratis.Arc.Queries.ModelBound;

namespace HttpFixture;

/// <summary>A lookup that uses a conventional model-bound route.</summary>
/// <param name="Value">The requested identifier.</param>
[ReadModel]
public record ModelBoundLookup(string Value)
{
    /// <summary>Returns the supplied GUID by its conventional query route.</summary>
    /// <param name="id">The identifier to read.</param>
    /// <returns>The lookup.</returns>
    [AllowAnonymous]
    public static ModelBoundLookup ById(Guid id) => new(id.ToString());
}
