using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Domain.Abstractions;

/// <summary>
/// Reads and writes the shop's own staff need, kept apart from the storefront
/// repositories on purpose: those are read-only by design, and folding stock
/// and price writes into them would let any storefront service mutate the
/// catalogue. One interface, one audience.
/// </summary>
public interface IAdminRepository
{
    /// <summary>
    /// <paramref name="search"/> matches a reference, customer name, email,
    /// phone or town — staff searching the queue have whichever of those the
    /// customer gave them on the phone, not a field name. <paramref name="placedFrom"/>
    /// and <paramref name="placedTo"/> bound <see cref="Order.CreatedAt"/>.
    /// </summary>
    Task<PagedResult<Order>> ListOrdersAsync(
        OrderStatus? status,
        string? search,
        DateTimeOffset? placedFrom,
        DateTimeOffset? placedTo,
        int page,
        int perPage,
        CancellationToken cancellationToken);

    /// <summary>
    /// By reference, with no ownership check — staff read every order, which is
    /// exactly why the endpoints behind this require the admin policy.
    /// </summary>
    Task<Order?> FindOrderAsync(string reference, CancellationToken cancellationToken);

    /// <summary>
    /// Includes inactive products, which the storefront list deliberately hides.
    /// Without this, deactivating a product is a one-way door — staff could
    /// never find it again to put it back.
    /// </summary>
    Task<PagedResult<Product>> ListProductsAsync(
        string? search,
        int page,
        int perPage,
        CancellationToken cancellationToken);

    Task<Product?> FindProductAsync(string productId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
