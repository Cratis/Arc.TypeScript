// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Cratis.Arc.Authorization;
using Cratis.Arc.Queries.ModelBound;

namespace HttpFixture;

/// <summary>
/// Fixture for Arc JSON naming, enum and named floating point serialization.
/// </summary>
[ReadModel]
public record HttpMetric(double HTTPCount, double RecordedValue, MetricState State)
{
    /// <summary>
    /// Return a deterministic nonfinite metric over the real query route.
    /// </summary>
    [AllowAnonymous]
    [Path("/api/http-metric")]
    public static HttpMetric Current() => new(double.PositiveInfinity, double.NaN, MetricState.Running);
}
