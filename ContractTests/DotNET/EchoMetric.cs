// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Commands.ModelBound;

namespace HttpFixture;

/// <summary>Verify named floating point literals on input and output.</summary>
[Command]
[AllowAnonymous]
public record EchoMetric(double Value)
{
    /// <summary>Echo the parsed floating point value.</summary>
    public HttpMetricValue Handle() => new(Value);
}
