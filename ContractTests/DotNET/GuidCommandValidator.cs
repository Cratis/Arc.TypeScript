// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Commands;
using FluentValidation;

namespace HttpFixture;

/// <summary>Rejects an empty identifier.</summary>
public sealed class GuidCommandValidator : CommandValidator<GuidCommand>
{
    /// <summary>Registers the Guid rule.</summary>
    public GuidCommandValidator() => RuleFor(command => command.Id).NotEmpty().WithMessage("Id required");
}
