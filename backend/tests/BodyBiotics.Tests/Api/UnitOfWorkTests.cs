using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using BodyBiotics.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace BodyBiotics.Tests.Api;

/// <summary>
/// The conflict itself needs Postgres's xmin, so these drive the retry loop by
/// throwing the exception EF raises when a concurrency token does not match.
/// </summary>
public sealed class UnitOfWorkTests : IDisposable
{
    private readonly AppDbContext _db = new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
        // The in-memory provider has no transactions; the loop around them is
        // what is under test.
        .ConfigureWarnings(warnings => warnings.Ignore(InMemoryEventId.TransactionIgnoredWarning))
        .Options);

    public void Dispose() => _db.Dispose();

    [Fact]
    public async Task ConflictRerunsTheActionWithNothingTracked()
    {
        var attempts = 0;
        var trackedOnRerun = -1;

        var result = await new UnitOfWork(_db).InTransactionAsync(
            _ =>
            {
                attempts++;

                if (attempts == 1)
                {
                    _db.Categories.Add(new Category { Id = "c1", Slug = "serums", Name = "Serums" });
                    throw new DbUpdateConcurrencyException("stock moved");
                }

                trackedOnRerun = _db.ChangeTracker.Entries().Count();
                return Task.FromResult("placed");
            },
            CancellationToken.None);

        Assert.Equal("placed", result);
        Assert.Equal(2, attempts);
        // The failed pass's added row would otherwise be inserted by the rerun.
        Assert.Equal(0, trackedOnRerun);
    }

    [Fact]
    public async Task PersistentConflictGivesUpAfterThreeRetries()
    {
        var attempts = 0;

        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() =>
            new UnitOfWork(_db).InTransactionAsync<string>(
                _ =>
                {
                    attempts++;
                    throw new DbUpdateConcurrencyException("stock moved");
                },
                CancellationToken.None));

        Assert.Equal(4, attempts);
    }

    [Fact]
    public async Task OtherFailuresAreNotRetried()
    {
        var attempts = 0;

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            new UnitOfWork(_db).InTransactionAsync<string>(
                _ =>
                {
                    attempts++;
                    throw new InvalidOperationException("out of stock");
                },
                CancellationToken.None));

        Assert.Equal(1, attempts);
    }
}
