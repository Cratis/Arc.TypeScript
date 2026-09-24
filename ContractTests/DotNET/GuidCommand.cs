// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Commands.ModelBound;

namespace HttpFixture;

/// <summary>
/// Exercises the FluentValidation Guid.Empty rule over HTTP.
/// </summary>
/// <param name="Id">The identifier to validate.</param>
[Command]
[AllowAnonymous]
public record GuidCommand(Guid Id)
{
    /// <summary>Returns the validated identifier.</summary>
    /// <returns>The identifier.</returns>
    public Guid Handle() => Id;
}
