// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Queries.ModelBound;

namespace HttpFixture;

/// <summary>
/// Exercises a static model-bound query and its named argument in the pinned Arc package.
/// </summary>
/// <param name="Title">The queried title.</param>
[ReadModel]
public record ModelBoundTitle(string Title)
{
    /// <summary>
    /// Returns the title requested by the caller.
    /// </summary>
    /// <param name="title">The title to read.</param>
    /// <returns>The read model.</returns>
    [AllowAnonymous]
    [Cratis.Arc.Queries.ModelBound.Path("/api/model-bound-title")]
    public static ModelBoundTitle Get(string title) => new(title);
}
