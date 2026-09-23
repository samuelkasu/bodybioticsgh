using BodyBiotics.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace BodyBiotics.Tests.Postgres;

/// <summary>
/// Runs only when BODYBIOTICS_TEST_POSTGRES holds a connection string. The
/// behaviour these tests cover — xmin, row locks, ON CONFLICT — does not exist
/// in the in-memory provider, so without a real server they are skipped rather
/// than passed.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class PostgresFactAttribute : FactAttribute
{
    public PostgresFactAttribute()
    {
        if (PostgresDatabase.ServerConnectionString is null)
        {
            Skip = "Set BODYBIOTICS_TEST_POSTGRES to a Postgres connection string to run this.";
        }
    }
}

/// <summary>
/// A throwaway database per test, built by running the migrations — the same
/// way production gets its schema, so the migrations are under test too.
/// </summary>
public sealed class PostgresDatabase : IAsyncDisposable
{
    private PostgresDatabase(string connectionString) => ConnectionString = connectionString;

    public static string? ServerConnectionString =>
        Environment.GetEnvironmentVariable("BODYBIOTICS_TEST_POSTGRES") is { Length: > 0 } value
            ? value
            : null;

    public string ConnectionString { get; }

    /// <param name="migration">Stop at this migration instead of the latest.</param>
    public static async Task<PostgresDatabase> CreateAsync(string? migration = null)
    {
        var builder = new NpgsqlConnectionStringBuilder(ServerConnectionString)
        {
            Database = $"bb_test_{Guid.NewGuid():N}",
        };

        var database = new PostgresDatabase(builder.ConnectionString);

        await using var context = database.NewContext();
        await context.GetService<IMigrator>().MigrateAsync(migration);

        return database;
    }

    /// <summary>
    /// Configured as DependencyInjection configures the real one. The retry
    /// strategy is optional because it refuses transactions a test opens by hand.
    /// </summary>
    public AppDbContext NewContext(bool retryOnFailure = false, params IInterceptor[] interceptors) =>
        new(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(ConnectionString, npgsql =>
            {
                if (retryOnFailure)
                {
                    npgsql.EnableRetryOnFailure(3, TimeSpan.FromSeconds(2), null);
                }

                npgsql.MigrationsHistoryTable("__ef_migrations_history");
            })
            .UseSnakeCaseNamingConvention()
            .AddInterceptors(interceptors)
            .Options);

    public async ValueTask DisposeAsync()
    {
        NpgsqlConnection.ClearAllPools();

        var builder = new NpgsqlConnectionStringBuilder(ConnectionString);
        var name = builder.Database;
        builder.Database = "postgres";

        await using var connection = new NpgsqlConnection(builder.ConnectionString);
        await connection.OpenAsync();
        await using var drop = new NpgsqlCommand($"DROP DATABASE IF EXISTS \"{name}\" WITH (FORCE)", connection);
        await drop.ExecuteNonQueryAsync();
    }
}
