using BodyBiotics.Domain.Entities;

namespace BodyBiotics.Domain.Abstractions;

public interface IWishlistRepository
{
    /// <summary>Saved products, newest first, with the product loaded.</summary>
    Task<IReadOnlyList<WishlistItem>> ListAsync(
        CartOwner owner,
        CancellationToken cancellationToken);

    Task<WishlistItem?> FindAsync(
        CartOwner owner,
        string productId,
        CancellationToken cancellationToken);

    void Add(WishlistItem item);

    void Remove(WishlistItem item);

    /// <summary>
    /// Moves an anonymous visitor's saved items onto their account at sign-in.
    /// Anything already saved on the account is dropped rather than duplicated.
    /// </summary>
    Task MergeAsync(string anonId, string userId, CancellationToken cancellationToken);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
