using System.Diagnostics;
using BodyBiotics.Api.Http;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BodyBiotics.Api;

/// <summary>
/// Read-your-database health check in the standard envelope. The load balancer
/// should pull an instance that cannot reach Postgres, not just one whose
/// process is still alive.
/// </summary>
public sealed class HealthCheckRunner(HealthCheckService healthChecks)
{
    public async Task<IResult> RunAsync(CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        var report = await healthChecks.CheckHealthAsync(cancellationToken);
        stopwatch.Stop();

        var payload = new
        {
            status = report.Status == HealthStatus.Healthy ? "ok" : "degraded",
            dbLatencyMs = (int)stopwatch.ElapsedMilliseconds,
            timestamp = DateTimeOffset.UtcNow,
            checks = report.Entries.ToDictionary(
                entry => entry.Key,
                entry => entry.Value.Status.ToString()),
        };

        if (report.Status != HealthStatus.Healthy)
        {
            return Results.Json(
                new ApiEnvelope<object>(payload),
                statusCode: StatusCodes.Status503ServiceUnavailable);
        }

        return ApiResults.Ok(payload);
    }
}
