// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Commands.ModelBound;

namespace HttpFixture;

/// <summary>
/// Exercises unmodified model-bound command discovery and response handling in the pinned Arc package.
/// </summary>
[Command]
[AllowAnonymous]
public record ModelBoundCommand(string Title)
{
    /// <summary>
    /// Returns the title the caller submitted.
    /// </summary>
    /// <returns>The title.</returns>
    public string Handle() => Title;
}
