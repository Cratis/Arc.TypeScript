// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Commands;
using FluentValidation;

namespace HttpFixture;

/// <summary>Rejects the fixture's invalid values.</summary>
public sealed class FilterParityCommandValidator : CommandValidator<FilterParityCommand>
{
    /// <summary>Declares the parity rule.</summary>
    public FilterParityCommandValidator()
    {
        RuleFor(command => command.Value).Must(value => !value.EndsWith("invalid", StringComparison.Ordinal))
            .WithMessage("Value is invalid");
    }
}
