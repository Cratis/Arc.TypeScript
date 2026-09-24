// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Commands;
using FluentValidation;

namespace HttpFixture;

/// <summary>
/// Pins model-bound rule failures, custom state and warning thresholds over HTTP.
/// </summary>
public sealed class ModelBoundCommandValidator : CommandValidator<ModelBoundCommand>
{
    /// <summary>
    /// Registers the fixture validation rules.
    /// </summary>
    public ModelBoundCommandValidator()
    {
        RuleFor(command => command.Title).NotEmpty().WithMessage("Title required").WithState(_ => "title-owned");
        RuleFor(command => command.Title).MinimumLength(5).WithMessage("Consider a longer title").WithSeverity(Severity.Warning);
    }
}
