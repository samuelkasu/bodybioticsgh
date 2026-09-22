using BodyBiotics.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BodyBiotics.Api;

/// <summary>
/// Hand-rolled instead of a third-party health-check package: it is four lines,
/// and the packaged version pinned an older EF Core than Infrastructure uses.
/// </summary>
public sealed class PostgresHealthCheck(AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            // A real round-trip. CanConnectAsync alone can pass against a pooled
            // handle that the server has since closed.
            _ = await db.Database.ExecuteSqlRawAsync("SELECT 1", cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return HealthCheckResult.Unhealthy("Cannot reach Postgres", exception);
        }
    }
}
