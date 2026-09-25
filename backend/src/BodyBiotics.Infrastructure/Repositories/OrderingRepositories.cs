using BodyBiotics.Domain.Abstractions;
using BodyBiotics.Domain.Common;
using BodyBiotics.Domain.Entities;
using BodyBiotics.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BodyBiotics.Infrastructure.Repositories;

public sealed class CartRepository(AppDbContext db) : ICartRepository
{
    public async Task<Cart?> FindAsync(CartOwner owner, CancellationToken cancellationToken) =>
        await Query(owner).FirstOrDefaultAsync(cancellationToken);

    public async Task<Cart> GetOrCreateAsync(CartOwner owner, CancellationToken cancellationToken)
    {
        var existing = await Query(owner).FirstOrDefaultAsync(cancellationToken);
        if (existing is not null)
        {
            return existing;
        }

        var now = DateTimeOffset.UtcNow;

        // Raw SQL for ON CONFLICT: two first adds racing both get here, and a
        // plain INSERT would fail the loser on the unique index — which inside
        // a transaction aborts it, with no way to recover and read the winner's
        // row. DO NOTHING waits for the winner to commit, skips, and the read
        // below then finds the one cart both requests share.
        await db.Database.ExecuteSqlInterpolatedAsync(
            $"""
            INSERT INTO carts (id, user_id, anon_id, created_at, updated_at)
            VALUES ({Identifier.New()}, {owner.UserId}, {owner.AnonId}, {now}, {now})
            ON CONFLICT DO NOTHING
            """,
            cancellationToken);

        return await Query(owner).FirstAsync(cancellationToken);
    }

    public void Remove(Cart cart) => db.Carts.Remove(cart);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);

    // Tracked: callers mutate quantities and save.
    //
    // Category and brand come along because a scoped campaign ("20% off
    // CeraVe") decides from them, and pricing a cart without them would
    // silently apply nothing.
    private IQueryable<Cart> Query(CartOwner owner) =>
        db.Carts
            .Include(cart => cart.Items)
            .ThenInclude(item => item.Product)
            .ThenInclude(product => product!.Category)
            .Include(cart => cart.Items)
            .ThenInclude(item => item.Product)
            .ThenInclude(product => product!.Brand)
            .Where(cart => owner.UserId != null
                ? cart.UserId == owner.UserId
                : cart.AnonId == owner.AnonId);
}

public sealed class OrderRepository(AppDbContext db) : IOrderRepository
{
    public async Task<Order?> FindByRequestIdAsync(
        string requestId,
        CancellationToken cancellationToken) =>
        await db.Orders
            .Include(order => order.Items)
            .ThenInclude(item => item.Product)
            .FirstOrDefaultAsync(order => order.RequestId == requestId, cancellationToken);

    public async Task<Order?> FindByReferenceAsync(
        string reference,
        string? userId,
        bool guestAccessGranted,
        CancellationToken cancellationToken) =>
        await db.Orders
            .AsNoTracking()
            .Include(order => order.Items)
            .ThenInclude(item => item.Product)
            .FirstOrDefaultAsync(
                order => order.Reference == reference &&
                    // A customer's order is readable by that customer; a guest
                    // order only by the browser holding the grant cookie. The
                    // reference on its own proves nothing.
                    ((userId != null && order.UserId == userId) ||
                        (guestAccessGranted && order.UserId == null)),
                cancellationToken);

    public async Task<IReadOnlyList<Order>> ListForUserAsync(
        string userId,
        CancellationToken cancellationToken) =>
        await db.Orders
            .AsNoTracking()
            .Include(order => order.Items)
            .Where(order => order.UserId == userId)
            .OrderByDescending(order => order.CreatedAt)
            .ToListAsync(cancellationToken);

    public void Add(Order order) => db.Orders.Add(order);

    public Task SaveChangesAsync(CancellationToken cancellationToken) =>
        db.SaveChangesAsync(cancellationToken);
}

public sealed class UnitOfWork(AppDbContext db) : IUnitOfWork
{
    // Retries after a concurrency conflict, on top of the first attempt. A
    // conflict needs another writer inside the same few milliseconds, so three
    // in a row means real contention and the caller is better off told.
    private const int MaxConflictRetries = 3;

    public async Task<T> InTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken)
    {
        // The Npgsql retry strategy refuses ambient transactions unless the
        // whole block is executed through it, so use the execution strategy.
        var strategy = db.Database.CreateExecutionStrategy();
        var rerun = false;

        for (var conflicts = 0; ; conflicts++)
        {
            try
            {
                return await strategy.ExecuteAsync(async () =>
                {
                    // A rerun must start from what the database holds now. The
                    // failed pass left its entities tracked, stale and modified:
                    // reusing them would re-apply the old arithmetic, and its
                    // added rows would be inserted a second time.
                    if (rerun)
                    {
                        db.ChangeTracker.Clear();
                    }

                    rerun = true;

                    await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
                    var result = await action(cancellationToken);
                    await transaction.CommitAsync(cancellationToken);
                    return result;
                });
            }
            catch (DbUpdateConcurrencyException) when (conflicts < MaxConflictRetries)
            {
                // Another transaction wrote a row this one read (stock, a
                // coupon counter) and committed first. The rollback has
                // already happened; go round again against the new values.
            }
        }
    }
}
