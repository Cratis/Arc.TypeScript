// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Validation;
using FluentValidation;

namespace HttpFixture;

/// <summary>
/// Validates the rate wherever it appears in the model graph.
/// </summary>
public sealed class FixtureRateValidator : ConceptValidator<FixtureRate>
{
    /// <summary>
    /// Declares the positive-rate rule.
    /// </summary>
    public FixtureRateValidator() => RuleFor(rate => rate.Value).GreaterThan(0m).WithMessage("Rate must be positive");
}
