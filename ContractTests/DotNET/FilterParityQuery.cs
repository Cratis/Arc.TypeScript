// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Queries.ModelBound;

namespace HttpFixture;

/// <summary>Exercises global query admission and validation over HTTP.</summary>
[ReadModel]
public record FilterParityQuery(string Value)
{
    /// <summary>Returns the query value after admission and validation.</summary>
    /// <param name="value">The query argument.</param>
    /// <returns>The value.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/filter-parity-query")]
    public static FilterParityQuery Find(string value) => new(value);
}
