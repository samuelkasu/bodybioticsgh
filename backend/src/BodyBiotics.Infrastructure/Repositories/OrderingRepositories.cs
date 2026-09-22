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

        var cart = new Cart
        {
            Id = Identifier.New(),
            UserId = owner.UserId,
            AnonId = owner.AnonId,
        };

        db.Carts.Add(cart);
        await db.SaveChangesAsync(cancellationToken);
        return cart;
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
    public async Task<T> InTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken)
    {
        // The Npgsql retry strategy refuses ambient transactions unless the
        // whole block is executed through it, so use the execution strategy.
        var strategy = db.Database.CreateExecutionStrategy();

        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var result = await action(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return result;
        });
    }
}
