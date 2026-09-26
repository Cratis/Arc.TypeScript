// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Queries;
using FluentValidation;

namespace HttpFixture;

/// <summary>Rejects invalid query values after authorization.</summary>
public sealed class FilterParityQueryFindParametersValidator : QueryValidator<FilterParityQueryFindParameters>
{
    /// <summary>Defines the parity rule.</summary>
    public FilterParityQueryFindParametersValidator() => RuleFor(arguments => arguments.Value)
        .Must(value => !value.EndsWith("invalid", StringComparison.Ordinal)).WithMessage("Value is invalid");
}
