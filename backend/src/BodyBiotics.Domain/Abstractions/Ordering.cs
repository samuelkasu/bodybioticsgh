using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Domain.Abstractions;

/// <summary>
/// Identifies whose cart to load: a signed-in user, or the anonymous cookie a
/// first-time visitor carries. One of the two is always present.
/// </summary>
public sealed record CartOwner(string? UserId, string? AnonId)
{
    public bool IsAnonymous => UserId is null;

    public static CartOwner ForUser(string userId) => new(userId, null);

    public static CartOwner ForAnonymous(string anonId) => new(null, anonId);
}

public interface ICartRepository
{
    /// <summary>Loads the cart with its items and products, or null if none exists yet.</summary>
    Task<Cart?> FindAsync(CartOwner owner, CancellationToken cancellationToken);

    Task<Cart> GetOrCreateAsync(CartOwner owner, CancellationToken cancellationToken);

    void Remove(Cart cart);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}

public interface IOrderRepository
{
    /// <summary>
    /// Idempotency lookup: a checkout retried over a flaky mobile connection
    /// must return the original order rather than create a second one.
    /// </summary>
    Task<Order?> FindByRequestIdAsync(string requestId, CancellationToken cancellationToken);

    /// <summary>
    /// Readable by the customer who owns it, or — when <paramref name="guestAccessGranted"/>
    /// — by the browser that placed it while signed out. Never by reference alone.
    /// </summary>
    Task<Order?> FindByReferenceAsync(
        string reference,
        string? userId,
        bool guestAccessGranted,
        CancellationToken cancellationToken);

    Task<IReadOnlyList<Order>> ListForUserAsync(string userId, CancellationToken cancellationToken);

    void Add(Order order);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}

/// <summary>
/// Wraps the checkout write path in a single database transaction: reserving
/// stock and writing the order must both happen, or neither.
///
/// The action may run more than once. When another transaction changes a row
/// it read (stock, a coupon counter) the attempt is rolled back and rerun with
/// every tracked entity discarded, so the action must load what it changes
/// itself rather than close over entities loaded before the call.
/// </summary>
public interface IUnitOfWork
{
    Task<T> InTransactionAsync<T>(
        Func<CancellationToken, Task<T>> action,
        CancellationToken cancellationToken);
}
