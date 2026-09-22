namespace BodyBiotics.Domain.Entities;

/// <summary>
/// A saved product, keyed by user when signed in and by the anonymous cookie
/// otherwise — the same identity the cart uses, so a guest's saved items follow
/// them into their account on sign-up.
///
/// There is no parent "Wishlist" row on purpose. A cart has aggregate state
/// (subtotal, item count, per-line quantity) that has to live somewhere; a
/// wishlist is a set of products and nothing more, so a parent row would carry
/// only a foreign key.
///
/// It is stored server-side rather than in localStorage because iOS evicts a
/// whole origin's storage after about seven days of no use. A cart that
/// vanishes is annoying; a wishlist someone curated over a month is worse.
/// </summary>
public sealed class WishlistItem
{
    public required string Id { get; init; }

    public string? UserId { get; set; }
    public User? User { get; set; }

    /// <summary>Identifier from the anonymous cart cookie, before sign-in.</summary>
    public string? AnonId { get; set; }

    public required string ProductId { get; init; }
    public Product? Product { get; init; }

    /// <summary>Newest first is the order a saved-items list is read in.</summary>
    public DateTimeOffset CreatedAt { get; init; } = DateTimeOffset.UtcNow;
}
